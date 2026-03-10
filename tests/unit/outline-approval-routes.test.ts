import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { reviseOutlineFromFilesWithOpenAIMock, listTaskFilesForModelMock, triggerTaskMock } = vi.hoisted(() => ({
  reviseOutlineFromFilesWithOpenAIMock: vi.fn(),
  listTaskFilesForModelMock: vi.fn(),
  triggerTaskMock: vi.fn()
}));

vi.mock("@trigger.dev/sdk/v3", () => ({
  tasks: {
    trigger: triggerTaskMock
  }
}));

vi.mock("../../src/lib/ai/services/revise-outline-from-files", () => ({
  reviseOutlineFromFilesWithOpenAI: reviseOutlineFromFilesWithOpenAIMock
}));

vi.mock("../../src/lib/tasks/save-task-files", async () => {
  const actual = await vi.importActual("../../src/lib/tasks/save-task-files");

  return {
    ...actual,
    listTaskFilesForModel: listTaskFilesForModelMock
  };
});

import { handleOutlineApprovalRequest } from "../../app/api/tasks/[taskId]/outline/approve/route";
import { handleOutlineFeedbackRequest } from "../../app/api/tasks/[taskId]/outline/feedback/route";
import {
  getTaskOutlineVersion,
  getTaskSummary,
  patchTaskSummary,
  resetTaskOutlineStore,
  resetTaskStore,
  saveTaskSummary,
  updateTaskStatus
} from "../../src/lib/tasks/repository";
import {
  appendPaymentLedgerEntry,
  getPaymentLedgerEntries,
  getUserWallet,
  resetPaymentState,
  seedUserWallet,
  setUserWallet
} from "../../src/lib/payments/repository";
import { freezeQuota } from "../../src/lib/billing/freeze-quota";
import { releaseQuota } from "../../src/lib/billing/release-quota";
import { settleQuota } from "../../src/lib/billing/settle-quota";
import { saveOutlineVersion } from "../../src/lib/tasks/save-outline-version";

describe("outline approval routes", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    resetTaskStore();
    resetTaskOutlineStore();
    resetPaymentState();
    // Seed wallet so quota freeze succeeds during approval
    seedUserWallet("user-1", {
      rechargeQuota: 5000,
      subscriptionQuota: 0,
      frozenQuota: 0
    });
    reviseOutlineFromFilesWithOpenAIMock.mockReset();
    listTaskFilesForModelMock.mockReset();
    triggerTaskMock.mockReset();
    triggerTaskMock.mockResolvedValue({ id: "run-approved-task-default" });
  });

  function makeApprovedOutlineDeps(taskId: string, outlineVersionId: string, userId = "user-1") {
    return {
      requireUser: async () => ({
        id: userId,
        email: `${userId}@example.com`,
        role: "user" as const
      }),
      isPersistenceReady: () => true,
      approveOutline: async () => {
        patchTaskSummary(taskId, {
          latestOutlineVersionId: outlineVersionId
        });

        return {
          task: getTaskSummary(taskId)!,
          outlineVersion: {
            ...getTaskOutlineVersion(taskId, outlineVersionId)!,
            isApproved: true
          }
        };
      },
      reserveQuotaForTask: async () => {
        const previousStatus = getTaskSummary(taskId)?.status ?? "awaiting_outline_approval";
        const previousLastWorkflowStage = getTaskSummary(taskId)?.lastWorkflowStage ?? null;
        const previousWorkflowErrorMessage =
          getTaskSummary(taskId)?.workflowErrorMessage ?? null;
        const wallet = getUserWallet(userId);
        const frozen = freezeQuota({
          wallet,
          amount: 690,
          taskId,
          chargePath: "generation"
        });

        setUserWallet(userId, frozen.wallet);
        appendPaymentLedgerEntry(userId, frozen.entry);
        patchTaskSummary(taskId, {
          status: "drafting",
          quotaReservation: frozen.reservation,
          approvalAttemptCount: (getTaskSummary(taskId)?.approvalAttemptCount ?? 0) + 1,
          lastWorkflowStage: "drafting"
        });

        return {
          reservation: frozen.reservation,
          approvalAttemptCount: getTaskSummary(taskId)?.approvalAttemptCount ?? 1,
          previousStatus,
          previousLastWorkflowStage,
          previousWorkflowStageTimestamps: getTaskSummary(taskId)?.workflowStageTimestamps ?? {},
          previousWorkflowErrorMessage
        };
      },
      settleQuotaForTask: async (_taskId: string, settleUserId: string, reservation: any) => {
        const wallet = getUserWallet(settleUserId);
        const settled = settleQuota({ wallet, reservation });
        setUserWallet(settleUserId, settled.wallet);
        appendPaymentLedgerEntry(settleUserId, settled.entry);
        patchTaskSummary(taskId, {
          quotaReservation: undefined
        });
      },
      finalizeStartupFailure: async (_input: any) => {
        const task = getTaskSummary(taskId);
        const reservation = task?.quotaReservation;
        if (reservation) {
          const wallet = getUserWallet(userId);
          const released = releaseQuota({ wallet, reservation });
          setUserWallet(userId, released.wallet);
          appendPaymentLedgerEntry(userId, released.entry);
        }

        if (task) {
          saveTaskSummary({
            ...task,
            status: "awaiting_outline_approval",
            quotaReservation: undefined,
            lastWorkflowStage: null,
            workflowStageTimestamps: {},
            workflowErrorMessage: null
          });
        }

        return {
          applied: true,
          released: Boolean(reservation),
          status: "awaiting_outline_approval"
        };
      }
    };
  }

  it("refuses to use the local in-memory task store as a fake production pipeline", async () => {
    const initialVersion = await saveOutlineVersion({
      task: {
        id: "task-outline-offline",
        userId: "user-1",
        status: "awaiting_outline_approval",
        targetWordCount: 2200,
        citationStyle: "APA 7",
        specialRequirements: "",
        topic: "Corporate Governance",
        outlineRevisionCount: 0
      },
      userId: "user-1",
      outline: {
        articleTitle: "Corporate Governance in ASEAN Banking",
        targetWordCount: 2200,
        citationStyle: "APA 7",
        chineseMirrorPending: true,
        sections: [
          {
            title: "Introduction",
            summary: "Outline summary",
            bulletPoints: ["a", "b", "c"]
          }
        ]
      }
    });

    const response = await handleOutlineApprovalRequest(
      new Request("http://localhost/api/tasks/task-outline-offline/outline/approve", {
        method: "POST",
        body: JSON.stringify({
          outlineVersionId: initialVersion.id
        }),
        headers: {
          "content-type": "application/json"
        }
      }),
      {
        taskId: "task-outline-offline"
      },
      {
        requireUser: async () => ({
          id: "user-1",
          email: "user-1@example.com",
          role: "user"
        })
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.ok).toBe(false);
    expect(payload.message).toContain("真实数据库");
  });

  it("creates a new outline version from user feedback and increases the revision count", async () => {
    await saveOutlineVersion({
      task: {
        id: "task-outline-1",
        userId: "user-1",
        status: "awaiting_outline_approval",
        targetWordCount: 2200,
        citationStyle: "APA 7",
        specialRequirements: "Focus on ASEAN banking examples.",
        topic: "Corporate Governance",
        outlineRevisionCount: 0,
        analysisSnapshot: {
          chosenTaskFileId: "file-1",
          supportingFileIds: [],
          ignoredFileIds: [],
          needsUserConfirmation: false,
          reasoning: "The brief already defines the assignment.",
          targetWordCount: 2200,
          citationStyle: "APA 7",
          topic: "Corporate Governance",
          chapterCount: 4,
          mustCover: ["Board oversight"],
          gradingFocus: ["Critical analysis"],
          appliedSpecialRequirements: "Focus on ASEAN banking examples.",
          usedDefaultWordCount: false,
          usedDefaultCitationStyle: false,
          warnings: []
        }
      },
      userId: "user-1",
      outline: {
        articleTitle: "Corporate Governance: A Structured Analysis",
        targetWordCount: 2200,
        citationStyle: "APA 7",
        chineseMirrorPending: true,
        sections: [
          {
            title: "Introduction",
            summary: "Introduction summary",
            bulletPoints: ["a", "b", "c", "d"]
          }
        ]
      }
    });

    listTaskFilesForModelMock.mockResolvedValue([
      {
        id: "file-1",
        taskId: "task-outline-1",
        userId: "user-1",
        originalFilename: "assignment.txt",
        storagePath: "users/user-1/tasks/task-outline-1/uploads/assignment.txt",
        extractedText: "Assignment brief for ASEAN banking governance.",
        role: "requirement",
        isPrimary: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        rawBody: Buffer.from("Assignment brief for ASEAN banking governance.")
      }
    ]);
    reviseOutlineFromFilesWithOpenAIMock.mockResolvedValue({
      articleTitle: "Corporate Governance in ASEAN Banking",
      targetWordCount: 2200,
      citationStyle: "APA 7",
      chineseMirrorPending: true,
      chineseMirror: null,
      sections: [
        {
          title: "Introduction",
          summary: "Introduce the ASEAN banking governance context.",
          bulletPoints: ["Context", "Argument", "Scope", "Method"]
        }
      ]
    });

    const response = await handleOutlineFeedbackRequest(
      new Request("http://localhost/api/tasks/task-outline-1/outline/feedback", {
        method: "POST",
        body: JSON.stringify({
          feedback: "Shorter please. Keep it simpler."
        }),
        headers: {
          "content-type": "application/json"
        }
      }),
      {
        taskId: "task-outline-1"
      },
      {
        isPersistenceReady: () => true,
        requireUser: async () => ({
          id: "user-1",
          email: "user-1@example.com",
          role: "user"
        })
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.outlineVersion.versionNumber).toBe(2);
    expect(payload.outline.sections[0].bulletPoints).toHaveLength(4);
    expect(payload.task.status).toBe("awaiting_outline_approval");
    expect(getTaskSummary("task-outline-1")?.outlineRevisionCount).toBe(1);
  });

  it("blocks further outline revisions after the configured limit", async () => {
    await saveOutlineVersion({
      task: {
        id: "task-outline-2",
        userId: "user-1",
        status: "awaiting_outline_approval",
        targetWordCount: 2200,
        citationStyle: "APA 7",
        specialRequirements: "",
        topic: "Corporate Governance",
        outlineRevisionCount: 5
      },
      userId: "user-1",
      outline: {
        articleTitle: "Corporate Governance: A Structured Analysis",
        targetWordCount: 2200,
        citationStyle: "APA 7",
        chineseMirrorPending: true,
        sections: []
      }
    });

    const response = await handleOutlineFeedbackRequest(
      new Request("http://localhost/api/tasks/task-outline-2/outline/feedback", {
        method: "POST",
        body: JSON.stringify({
          feedback: "Add another section."
        }),
        headers: {
          "content-type": "application/json"
        }
      }),
      {
        taskId: "task-outline-2"
      },
      {
        isPersistenceReady: () => true,
        requireUser: async () => ({
          id: "user-1",
          email: "user-1@example.com",
          role: "user"
        })
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.message).toContain("上限");
  });

  it("approves the chosen outline version, freezes quota, and returns drafting immediately", async () => {
    const initialVersion = await saveOutlineVersion({
      task: {
        id: "task-outline-3",
        userId: "user-1",
        status: "awaiting_outline_approval",
        targetWordCount: 2200,
        citationStyle: "Harvard",
        specialRequirements: "",
        topic: "Corporate Governance",
        outlineRevisionCount: 0
      },
      userId: "user-1",
      outline: {
        articleTitle: "Corporate Governance: A Structured Analysis",
        targetWordCount: 2200,
        citationStyle: "Harvard",
        chineseMirrorPending: true,
        sections: []
      }
    });

    const enqueueApprovedTaskRun = vi.fn().mockResolvedValue("run-approved-task-1");
    const enqueueApprovedTaskStartupCheck = vi
      .fn()
      .mockResolvedValue("run-approved-task-startup-check-1");

    const response = await handleOutlineApprovalRequest(
      new Request("http://localhost/api/tasks/task-outline-3/outline/approve", {
        method: "POST",
        body: JSON.stringify({
          outlineVersionId: initialVersion.id
        }),
        headers: {
          "content-type": "application/json"
        }
      }),
      {
        taskId: "task-outline-3"
      },
      {
        ...makeApprovedOutlineDeps("task-outline-3", initialVersion.id),
        enqueueApprovedTaskRun,
        enqueueApprovedTaskStartupCheck
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload.task.status).toBe("drafting");
    expect(payload.outlineVersion.isApproved).toBe(true);
    expect(payload.downloads.finalDocxOutputId).toBeNull();
    expect(payload.downloads.referenceReportOutputId).toBeNull();
    expect(payload.finalWordCount).toBeNull();
    expect(payload.message).toContain("正文写作");
    expect(enqueueApprovedTaskRun).toHaveBeenCalledTimes(1);
    expect(enqueueApprovedTaskStartupCheck).toHaveBeenCalledTimes(1);
    expect(enqueueApprovedTaskRun).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "task-outline-3",
        userId: "user-1",
        approvalAttemptCount: 1
      })
    );
    expect(getTaskSummary("task-outline-3")?.latestOutlineVersionId).toBe(initialVersion.id);
  });

  it("releases quota and rolls back when enqueueing the writing pipeline fails", async () => {
    const initialVersion = await saveOutlineVersion({
      task: {
        id: "task-outline-4",
        userId: "user-1",
        status: "awaiting_outline_approval",
        targetWordCount: 2200,
        citationStyle: "Harvard",
        specialRequirements: "",
        topic: "Corporate Governance",
        outlineRevisionCount: 0
      },
      userId: "user-1",
      outline: {
        articleTitle: "Corporate Governance: A Structured Analysis",
        targetWordCount: 2200,
        citationStyle: "Harvard",
        chineseMirrorPending: true,
        sections: []
      }
    });

    const response = await handleOutlineApprovalRequest(
      new Request("http://localhost/api/tasks/task-outline-4/outline/approve", {
        method: "POST",
        body: JSON.stringify({
          outlineVersionId: initialVersion.id
        }),
        headers: {
          "content-type": "application/json"
        }
      }),
      {
        taskId: "task-outline-4"
      },
      {
        ...makeApprovedOutlineDeps("task-outline-4", initialVersion.id),
        enqueueApprovedTaskRun: async () => {
          throw new Error("queue exploded");
        }
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.message).toContain("queue exploded");
    expect(getUserWallet("user-1")).toEqual({
      rechargeQuota: 5000,
      subscriptionQuota: 0,
      frozenQuota: 0
    });
    expect(getTaskSummary("task-outline-4")?.status).toBe("awaiting_outline_approval");
    expect(
      [...getPaymentLedgerEntries("user-1").map((entry) => entry.kind)].sort()
    ).toEqual(["task_freeze", "task_release"]);
  });

  it("returns 409 when the same task is already being processed", async () => {
    const initialVersion = await saveOutlineVersion({
      task: {
        id: "task-outline-7",
        userId: "user-1",
        status: "awaiting_outline_approval",
        targetWordCount: 2200,
        citationStyle: "APA 7",
        specialRequirements: "",
        topic: "Corporate Governance",
        outlineRevisionCount: 0
      },
      userId: "user-1",
      outline: {
        articleTitle: "Corporate Governance: A Structured Analysis",
        targetWordCount: 2200,
        citationStyle: "APA 7",
        chineseMirrorPending: true,
        sections: []
      }
    });

    const response = await handleOutlineApprovalRequest(
      new Request("http://localhost/api/tasks/task-outline-7/outline/approve", {
        method: "POST",
        body: JSON.stringify({
          outlineVersionId: initialVersion.id
        }),
        headers: {
          "content-type": "application/json"
        }
      }),
      {
        taskId: "task-outline-7"
      },
      {
        ...makeApprovedOutlineDeps("task-outline-7", initialVersion.id),
        reserveQuotaForTask: async () => {
          throw new Error("TASK_ALREADY_PROCESSING");
        }
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.ok).toBe(false);
    expect(payload.message).toContain("处理中");
  });

  it("logs the raw database error when quota reservation fails before drafting starts", async () => {
    const initialVersion = await saveOutlineVersion({
      task: {
        id: "task-outline-8",
        userId: "user-1",
        status: "awaiting_outline_approval",
        targetWordCount: 1000,
        citationStyle: "APA 7",
        specialRequirements: "",
        topic: "Corporate Governance",
        outlineRevisionCount: 0
      },
      userId: "user-1",
      outline: {
        articleTitle: "Corporate Governance: A Structured Analysis",
        targetWordCount: 1000,
        citationStyle: "APA 7",
        chineseMirrorPending: true,
        sections: []
      }
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await handleOutlineApprovalRequest(
      new Request("http://localhost/api/tasks/task-outline-8/outline/approve", {
        method: "POST",
        body: JSON.stringify({
          outlineVersionId: initialVersion.id
        }),
        headers: {
          "content-type": "application/json"
        }
      }),
      {
        taskId: "task-outline-8"
      },
      {
        ...makeApprovedOutlineDeps("task-outline-8", initialVersion.id),
        reserveQuotaForTask: async () => {
          throw new Error('原子更新积分失败：column reference "recharge_quota" is ambiguous');
        }
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.message).toContain('recharge_quota');
    expect(getTaskSummary("task-outline-8")?.status).toBe("awaiting_outline_approval");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[outline-approve] quota reservation failed:",
      expect.objectContaining({
        taskId: "task-outline-8",
        userId: "user-1",
        error: '原子更新积分失败：column reference "recharge_quota" is ambiguous'
      })
    );

    consoleErrorSpy.mockRestore();
  });

  it("increments the approval attempt count and passes it into the background trigger", async () => {
    const initialVersion = await saveOutlineVersion({
      task: {
        id: "task-outline-retry",
        userId: "user-1",
        status: "awaiting_outline_approval",
        targetWordCount: 1000,
        citationStyle: "APA 7",
        specialRequirements: "",
        topic: "Corporate Governance",
        outlineRevisionCount: 0
      },
      userId: "user-1",
      outline: {
        articleTitle: "Corporate Governance: A Structured Analysis",
        targetWordCount: 1000,
        citationStyle: "APA 7",
        chineseMirrorPending: true,
        sections: []
      }
    });

    const enqueueApprovedTaskRun1 = vi.fn().mockResolvedValue("run-approved-task-1");
    const enqueueApprovedTaskStartupCheck1 = vi
      .fn()
      .mockResolvedValue("run-approved-task-startup-check-1");
    const deps1 = {
      ...makeApprovedOutlineDeps("task-outline-retry", initialVersion.id),
      enqueueApprovedTaskRun: enqueueApprovedTaskRun1,
      enqueueApprovedTaskStartupCheck: enqueueApprovedTaskStartupCheck1
    } as any;

    const response1 = await handleOutlineApprovalRequest(
      new Request("http://localhost/api/tasks/task-outline-retry/outline/approve", {
        method: "POST",
        body: JSON.stringify({
          outlineVersionId: initialVersion.id
        }),
        headers: {
          "content-type": "application/json"
        }
      }),
      {
        taskId: "task-outline-retry"
      },
      deps1
    );
    const payload1 = await response1.json();

    expect(response1.status).toBe(202);
    expect(payload1.task.status).toBe("drafting");
    expect(payload1.task.lastWorkflowStage).toBe("drafting");
    expect(enqueueApprovedTaskRun1).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "task-outline-retry",
        userId: "user-1"
      }),
    );
    expect(enqueueApprovedTaskRun1).toHaveBeenCalledWith(
      expect.objectContaining({
        approvalAttemptCount: 1
      })
    );

    updateTaskStatus("task-outline-retry", "failed");
    patchTaskSummary("task-outline-retry", {
      quotaReservation: undefined,
      lastWorkflowStage: "exporting"
    });

    const enqueueApprovedTaskRun2 = vi.fn().mockResolvedValue("run-approved-task-2");
    const enqueueApprovedTaskStartupCheck2 = vi
      .fn()
      .mockResolvedValue("run-approved-task-startup-check-2");
    const deps2 = {
      ...makeApprovedOutlineDeps("task-outline-retry", initialVersion.id),
      enqueueApprovedTaskRun: enqueueApprovedTaskRun2,
      enqueueApprovedTaskStartupCheck: enqueueApprovedTaskStartupCheck2
    } as any;

    const response2 = await handleOutlineApprovalRequest(
      new Request("http://localhost/api/tasks/task-outline-retry/outline/approve", {
        method: "POST",
        body: JSON.stringify({
          outlineVersionId: initialVersion.id
        }),
        headers: {
          "content-type": "application/json"
        }
      }),
      {
        taskId: "task-outline-retry"
      },
      deps2
    );
    const payload2 = await response2.json();

    expect(response2.status).toBe(202);
    expect(payload2.task.status).toBe("drafting");
    expect(payload2.task.lastWorkflowStage).toBe("drafting");
    expect(enqueueApprovedTaskRun2).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "task-outline-retry",
        userId: "user-1"
      }),
    );
    expect(enqueueApprovedTaskRun2).toHaveBeenCalledWith(
      expect.objectContaining({
        approvalAttemptCount: 2
      })
    );
  });
});

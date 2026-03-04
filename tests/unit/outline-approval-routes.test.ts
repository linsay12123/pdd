import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { reviseOutlineFromFilesWithOpenAIMock, listTaskFilesForModelMock } = vi.hoisted(() => ({
  reviseOutlineFromFilesWithOpenAIMock: vi.fn(),
  listTaskFilesForModelMock: vi.fn()
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
  getTaskSummary,
  resetTaskOutlineStore,
  resetTaskStore,
  updateTaskStatus
} from "../../src/lib/tasks/repository";
import {
  getPaymentLedgerEntries,
  getUserWallet,
  resetPaymentState,
  seedUserWallet
} from "../../src/lib/payments/repository";
import { TaskProcessingStageError } from "../../src/lib/tasks/process-approved-task";
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

  it("approves the chosen outline version and keeps the approved version linked on the task", async () => {
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
        requireUser: async () => ({
          id: "user-1",
          email: "user-1@example.com",
          role: "user"
        }),
        processTask: async () => ({
          task: {
            ...getTaskSummary("task-outline-3")!,
            status: "deliverable_ready"
          },
          outlineVersion: {
            ...initialVersion,
            isApproved: true
          },
          downloads: {
            finalDocxOutputId: "out-final-1",
            referenceReportOutputId: "out-report-1"
          },
          finalDraftMarkdown: "# Title"
        })
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.task.status).toBe("deliverable_ready");
    expect(payload.outlineVersion.isApproved).toBe(true);
    expect(getTaskSummary("task-outline-3")?.latestOutlineVersionId).toBe(initialVersion.id);
  });

  it("can continue straight into final deliverables after approval when the processing step succeeds", async () => {
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
        requireUser: async () => ({
          id: "user-1",
          email: "user-1@example.com",
          role: "user"
        }),
        processTask: async () => ({
          task: {
            ...getTaskSummary("task-outline-4")!,
            status: "deliverable_ready"
          },
          outlineVersion: {
            ...initialVersion,
            isApproved: true
          },
          downloads: {
            finalDocxOutputId: "out-final-1",
            referenceReportOutputId: "out-report-1"
          },
          finalDraftMarkdown: "# Title"
        })
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.task.status).toBe("deliverable_ready");
    expect(payload.downloads.finalDocxOutputId).toBe("out-final-1");
    expect(payload.downloads.referenceReportOutputId).toBe("out-report-1");
  });

  it("refunds the charged quota when writing fails during drafting", async () => {
    const initialVersion = await saveOutlineVersion({
      task: {
        id: "task-outline-5",
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
      new Request("http://localhost/api/tasks/task-outline-5/outline/approve", {
        method: "POST",
        body: JSON.stringify({
          outlineVersionId: initialVersion.id
        }),
        headers: {
          "content-type": "application/json"
        }
      }),
      {
        taskId: "task-outline-5"
      },
      {
        requireUser: async () => ({
          id: "user-1",
          email: "user-1@example.com",
          role: "user"
        }),
        processTask: async () => {
          throw new TaskProcessingStageError(
            "drafting",
            new Error("drafting exploded")
          );
        }
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.message).toContain("drafting exploded");
    expect(getUserWallet("user-1")).toEqual({
      rechargeQuota: 5000,
      subscriptionQuota: 0,
      frozenQuota: 0
    });
    expect(
      [...getPaymentLedgerEntries("user-1").map((entry) => entry.kind)].sort()
    ).toEqual(["task_release", "task_settle"]);
  });

  it("does not refund the charged quota after the task has already moved past word adjustment", async () => {
    const initialVersion = await saveOutlineVersion({
      task: {
        id: "task-outline-6",
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
      new Request("http://localhost/api/tasks/task-outline-6/outline/approve", {
        method: "POST",
        body: JSON.stringify({
          outlineVersionId: initialVersion.id
        }),
        headers: {
          "content-type": "application/json"
        }
      }),
      {
        taskId: "task-outline-6"
      },
      {
        requireUser: async () => ({
          id: "user-1",
          email: "user-1@example.com",
          role: "user"
        }),
        processTask: async () => {
          updateTaskStatus("task-outline-6", "verifying_references");
          throw new Error("verification exploded");
        }
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.message).toContain("verification exploded");
    expect(getUserWallet("user-1")).toEqual({
      rechargeQuota: 4310,
      subscriptionQuota: 0,
      frozenQuota: 0
    });
    expect(getPaymentLedgerEntries("user-1").map((entry) => entry.kind)).toEqual([
      "task_settle"
    ]);
    expect(getTaskSummary("task-outline-6")?.status).toBe("verifying_references");
  });
});

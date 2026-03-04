import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { handleOutlineApprovalRequest } from "../../app/api/tasks/[taskId]/outline/approve/route";
import { handleOutlineFeedbackRequest } from "../../app/api/tasks/[taskId]/outline/feedback/route";
import {
  getTaskSummary,
  resetTaskOutlineStore,
  resetTaskStore
} from "../../src/lib/tasks/repository";
import {
  resetPaymentState,
  seedUserWallet
} from "../../src/lib/payments/repository";
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
        outlineRevisionCount: 0
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
    expect(payload.outline.sections[0].bulletPoints).toHaveLength(3);
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
});

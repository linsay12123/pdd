import { beforeEach, describe, expect, it } from "vitest";
import { handleHumanizeRequest } from "../../app/api/tasks/[taskId]/humanize/route";
import { resetPaymentState, seedUserWallet } from "../../src/lib/payments/repository";
import {
  resetTaskDraftStore,
  resetTaskStore,
  saveTaskDraftVersion,
  saveTaskSummary
} from "../../src/lib/tasks/repository";

function makeContext(taskId: string) {
  return { params: Promise.resolve({ taskId }) };
}

describe("humanize route", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    process.env.STEALTHGPT_API_KEY = "";
    resetPaymentState();
    resetTaskStore();
    resetTaskDraftStore();
  });

  it("does not pretend the feature is available when the real provider key is missing", async () => {
    saveTaskSummary({
      id: "task-humanize-1",
      userId: "user-1",
      status: "deliverable_ready",
      targetWordCount: 2200,
      citationStyle: "APA 7",
      latestDraftVersionId: "draft-1"
    });
    saveTaskDraftVersion({
      id: "draft-1",
      taskId: "task-humanize-1",
      userId: "user-1",
      versionNumber: 1,
      title: "Essay Title",
      bodyMarkdown: "This is the final draft body.",
      bodyWordCount: 6,
      referencesMarkdown: "Author, A. (2024). Source.",
      isActive: true,
      isCandidate: false
    });
    seedUserWallet("user-1", {
      rechargeQuota: 3000,
      subscriptionQuota: 0,
      frozenQuota: 0
    });

    const response = await handleHumanizeRequest(
      new Request("http://localhost/api/tasks/task-humanize-1/humanize", {
        method: "POST"
      }),
      makeContext("task-humanize-1"),
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
    expect(payload.message).toContain("未启用");
  });

  it("returns a completed humanized output instead of a fake queued success message", async () => {
    process.env.STEALTHGPT_API_KEY = "stealth-live-key";

    const response = await handleHumanizeRequest(
      new Request("http://localhost/api/tasks/task-humanize-2/humanize", {
        method: "POST"
      }),
      makeContext("task-humanize-2"),
      {
        requireUser: async () => ({
          id: "user-2",
          email: "user-2@example.com",
          role: "user"
        }),
        isPersistenceReady: () => true,
        loadTaskContext: async () => ({
          task: {
            id: "task-humanize-2",
            userId: "user-2",
            status: "deliverable_ready",
            citationStyle: "APA 7"
          },
          draftMarkdown: "# Title\n\n## Body\n\nDraft paragraph.\n\n## References\n\nRef",
          bodyWordCount: 200
        }),
        chargeQuota: async () => ({
          amount: 250,
          reservation: {
            taskId: "task-humanize-2",
            chargePath: "humanize",
            totalAmount: 250,
            fromSubscription: 0,
            fromRecharge: 250
          }
        }),
        runHumanize: async () => ({
          outputId: "out-humanized-1"
        })
      } as any
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.downloads.humanizedDocxOutputId).toBe("out-humanized-1");
    expect(payload.message).not.toContain("已排队");
  });
});

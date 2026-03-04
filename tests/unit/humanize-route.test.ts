import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  handleHumanizeStatusRequest,
  handleHumanizeRequest
} from "../../app/api/tasks/[taskId]/humanize/route";

function makeContext(taskId: string) {
  return { params: Promise.resolve({ taskId }) };
}

describe("humanize route", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.UNDETECTABLE_API_KEY = "";
    process.env.TRIGGER_SECRET_KEY = "";
  });

  it("does not pretend the feature is available when the real Undetectable key is missing", async () => {
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
      } as never
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.ok).toBe(false);
    expect(payload.message).toContain("Undetectable");
  });

  it("accepts the request, queues the background work, and returns 202 instead of fake instant success", async () => {
    process.env.UNDETECTABLE_API_KEY = "undetectable-live-key";
    process.env.TRIGGER_SECRET_KEY = "trigger-secret";

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
        loadHumanizeStatus: async () => ({
          status: "idle",
          outputId: null,
          errorMessage: null
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
        saveQueuedState: async () => undefined,
        enqueueHumanize: vi.fn(async () => undefined)
      } as never
    );
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload.ok).toBe(true);
    expect(payload.humanizeStatus).toBe("queued");
    expect(payload.downloads.humanizedDocxOutputId).toBeNull();
    expect(payload.message).toContain("处理中");
  });

  it("does not recharge or queue the task again when a humanize run is already processing", async () => {
    process.env.UNDETECTABLE_API_KEY = "undetectable-live-key";
    process.env.TRIGGER_SECRET_KEY = "trigger-secret";
    const chargeQuota = vi.fn();
    const enqueueHumanize = vi.fn();

    const response = await handleHumanizeRequest(
      new Request("http://localhost/api/tasks/task-humanize-3/humanize", {
        method: "POST"
      }),
      makeContext("task-humanize-3"),
      {
        requireUser: async () => ({
          id: "user-3",
          email: "user-3@example.com",
          role: "user"
        }),
        isPersistenceReady: () => true,
        loadTaskContext: async () => ({
          task: {
            id: "task-humanize-3",
            userId: "user-3",
            status: "deliverable_ready",
            citationStyle: "APA 7"
          },
          draftMarkdown: "# Title\n\n## Body\n\nDraft paragraph.\n\n## References\n\nRef",
          bodyWordCount: 200
        }),
        loadHumanizeStatus: async () => ({
          status: "processing",
          outputId: null,
          errorMessage: null
        }),
        chargeQuota,
        enqueueHumanize
      } as never
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.humanizeStatus).toBe("processing");
    expect(chargeQuota).not.toHaveBeenCalled();
    expect(enqueueHumanize).not.toHaveBeenCalled();
  });

  it("returns the current background progress through GET", async () => {
    const response = await handleHumanizeStatusRequest(
      new Request("http://localhost/api/tasks/task-humanize-4/humanize"),
      makeContext("task-humanize-4"),
      {
        requireUser: async () => ({
          id: "user-4",
          email: "user-4@example.com",
          role: "user"
        }),
        loadHumanizeStatusForUser: async () => ({
          status: "completed",
          outputId: "out-humanized-4",
          errorMessage: null,
          provider: "undetectable"
        })
      } as never
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.humanizeStatus).toBe("completed");
    expect(payload.downloads.humanizedDocxOutputId).toBe("out-humanized-4");
  });
});

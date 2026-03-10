import { describe, expect, it, vi } from "vitest";

import {
  assertRequiredTriggerTasks,
  checkTriggerProdStartup,
  pollTriggerRunStartup,
  resolveTriggerRuntimeState
} from "../../scripts/check-trigger-prod-startup.mjs";

describe("trigger prod startup self-check", () => {
  it("fails immediately when required tasks are missing from the current worker", () => {
    expect(() =>
      assertRequiredTriggerTasks({
        worker: {
          version: "20260310.1",
          tasks: [{ slug: "process-approved-task" }]
        }
      })
    ).toThrowError("TRIGGER_REQUIRED_TASKS_MISSING:verify-approved-task-startup");
  });

  it("treats PENDING_VERSION as an immediate startup failure", async () => {
    const result = await pollTriggerRunStartup({
      runId: "run-1",
      envApiKey: "tr_prod_test",
      retrieveRunState: vi.fn().mockResolvedValue({
        state: "pending_version",
        status: "PENDING_VERSION"
      }),
      sleep: async () => undefined
    });

    expect(result).toEqual({
      ok: false,
      runtime: {
        state: "pending_version",
        status: "PENDING_VERSION"
      }
    });
  });

  it("waits through unknown states and accepts the run once it becomes active", async () => {
    const retrieveRunState = vi
      .fn()
      .mockResolvedValueOnce({
        state: "unknown",
        status: null
      })
      .mockResolvedValueOnce({
        state: "unknown",
        status: null
      })
      .mockResolvedValueOnce({
        state: "active",
        status: "QUEUED"
      });

    const result = await pollTriggerRunStartup({
      runId: "run-2",
      envApiKey: "tr_prod_test",
      retrieveRunState,
      sleep: async () => undefined
    });

    expect(retrieveRunState).toHaveBeenCalledTimes(3);
    expect(result).toEqual({
      ok: true,
      runtime: {
        state: "active",
        status: "QUEUED"
      }
    });
  });

  it("orchestrates the full self-check and returns the worker version", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      const href = String(url);

      if (href.endsWith("/prod")) {
        return {
          ok: true,
          json: async () => ({
            apiKey: "tr_prod_live"
          })
        };
      }

      if (href.endsWith("/prod/workers/current")) {
        return {
          ok: true,
          json: async () => ({
            worker: {
              version: "20260310.1",
              tasks: [
                { slug: "process-approved-task" },
                { slug: "verify-approved-task-startup" }
              ]
            }
          })
        };
      }

      throw new Error(`unexpected url: ${href}`);
    });

    const result = await checkTriggerProdStartup({
      projectRef: "proj_test",
      credentials: {
        accessToken: "tr_pat_test",
        apiUrl: "https://api.trigger.dev"
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      triggerTask: vi.fn().mockResolvedValue("run-3"),
      retrieveRunState: vi.fn().mockResolvedValue({
        state: "active",
        status: "QUEUED"
      }),
      sleep: async () => undefined
    });

    expect(result).toEqual({
      projectRef: "proj_test",
      workerVersion: "20260310.1",
      taskSlugs: ["process-approved-task", "verify-approved-task-startup"],
      runId: "run-3",
      runtime: {
        state: "active",
        status: "QUEUED"
      }
    });
  });

  it("normalizes trigger statuses the same way as the app runtime check", () => {
    expect(resolveTriggerRuntimeState("QUEUED")).toEqual({
      state: "active",
      status: "QUEUED"
    });
    expect(resolveTriggerRuntimeState("PENDING_VERSION")).toEqual({
      state: "pending_version",
      status: "PENDING_VERSION"
    });
    expect(resolveTriggerRuntimeState("COMPLETED")).toEqual({
      state: "terminal",
      status: "COMPLETED"
    });
    expect(resolveTriggerRuntimeState(null)).toEqual({
      state: "unknown",
      status: null
    });
  });
});

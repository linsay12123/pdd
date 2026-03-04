import { describe, expect, it, vi } from "vitest";
import {
  requestHumanize,
  requestHumanizeStatus
} from "../../src/lib/tasks/request-humanize";

describe("requestHumanize helpers", () => {
  it("treats the first response as a queued background job instead of an instant finished file", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          taskId: "task-1",
          humanizeStatus: "queued",
          downloads: {
            humanizedDocxOutputId: null
          },
          message: "降AI任务已经提交，系统正在后台处理中。"
        }),
        {
          status: 202,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );

    const result = await requestHumanize({
      taskId: "task-1",
      fetchImpl: fetchImpl as typeof fetch
    });

    expect(result.humanizeStatus).toBe("queued");
    expect(result.downloads.humanizedDocxOutputId).toBeNull();
  });

  it("reads the latest background progress through the status endpoint", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          taskId: "task-2",
          humanizeStatus: "completed",
          provider: "undetectable",
          errorMessage: null,
          downloads: {
            humanizedDocxOutputId: "out-2"
          }
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );

    const result = await requestHumanizeStatus({
      taskId: "task-2",
      fetchImpl: fetchImpl as typeof fetch
    });

    expect(result.humanizeStatus).toBe("completed");
    expect(result.provider).toBe("undetectable");
    expect(result.downloads.humanizedDocxOutputId).toBe("out-2");
  });
});

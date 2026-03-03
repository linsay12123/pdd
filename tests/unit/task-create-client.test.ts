import { describe, expect, it, vi } from "vitest";
import { requestTaskCreate } from "../../src/lib/tasks/request-task-create";

describe("task create client", () => {
  it("submits special requirements to the task create api", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        task: {
          id: "task-1",
          status: "quota_frozen",
          targetWordCount: 2000,
          citationStyle: "APA 7",
          specialRequirements: "Focus on finance."
        },
        frozenQuota: 460,
        message: "任务已创建，460 积分已冻结。"
      })
    });

    const result = await requestTaskCreate({
      specialRequirements: "Focus on finance.",
      fetchImpl: fetchSpy as typeof fetch
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse(String(init?.body));

    expect(url).toBe("/api/tasks/create");
    expect(body.specialRequirements).toBe("Focus on finance.");
    expect(result.task.id).toBe("task-1");
  });

  it("throws the server message when task creation fails", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        message: "当前积分不足，请先充值后再创建任务。"
      })
    });

    await expect(
      requestTaskCreate({
        specialRequirements: "",
        fetchImpl: fetchSpy as typeof fetch
      })
    ).rejects.toThrow("当前积分不足");
  });
});

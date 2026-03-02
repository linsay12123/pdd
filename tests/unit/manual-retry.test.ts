import { describe, expect, it } from "vitest";
import { resetTaskOutputStore, saveTaskSummary } from "../../src/lib/tasks/repository";
import { retryTaskFromFailure } from "../../src/lib/tasks/manual-retry";

describe("manual retry", () => {
  it("restarts a failed task from a safe step without double-charging", () => {
    resetTaskOutputStore();
    saveTaskSummary({
      id: "task-retry-1",
      status: "failed",
      targetWordCount: 2000,
      citationStyle: "APA 7"
    });

    const result = retryTaskFromFailure({
      taskId: "task-retry-1",
      restartAt: "drafting",
      operatorId: "admin-1"
    });

    expect(result.nextStatus).toBe("drafting");
    expect(result.quotaRecharged).toBe(false);
    expect(result.auditEntry.note).toContain("admin-1");
  });

  it("rejects retry when the task is not currently failed", () => {
    saveTaskSummary({
      id: "task-retry-2",
      status: "deliverable_ready",
      targetWordCount: 2000,
      citationStyle: "APA 7"
    });

    expect(() =>
      retryTaskFromFailure({
        taskId: "task-retry-2",
        restartAt: "drafting",
        operatorId: "admin-1"
      })
    ).toThrow("Only failed tasks can be retried");
  });
});

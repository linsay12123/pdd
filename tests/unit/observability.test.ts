import { describe, expect, it } from "vitest";
import { resetMetrics, getMetricCount } from "../../src/lib/observability/metrics";
import {
  listWorkflowLogs,
  resetWorkflowLogs
} from "../../src/lib/observability/logger";
import {
  resetPaymentState,
  seedUserWallet
} from "../../src/lib/payments/repository";
import {
  saveTaskSummary,
  updateTaskStatus
} from "../../src/lib/tasks/repository";
import { retryTaskFromFailure } from "../../src/lib/tasks/manual-retry";

describe("observability", () => {
  it("records a structured log and metric when task status changes", () => {
    resetWorkflowLogs();
    resetMetrics();
    saveTaskSummary({
      id: "task-observe-1",
      userId: "user-1",
      status: "created",
      targetWordCount: 2000,
      citationStyle: "APA 7"
    });

    updateTaskStatus("task-observe-1", "drafting");

    expect(getMetricCount("task_status_transition")).toBe(1);
    expect(listWorkflowLogs()).toEqual([
      expect.objectContaining({
        eventType: "task_transition",
        taskId: "task-observe-1",
        userId: "user-1",
        oldStatus: "created",
        newStatus: "drafting"
      })
    ]);
  });

  it("records a structured log and metric when an admin retries a failed task", () => {
    resetWorkflowLogs();
    resetMetrics();
    resetPaymentState();
    seedUserWallet("user-pay-1", {
      rechargeQuota: 1000,
      subscriptionQuota: 0,
      frozenQuota: 0
    });
    saveTaskSummary({
      id: "task-observe-2",
      userId: "user-pay-1",
      status: "failed",
      targetWordCount: 2000,
      citationStyle: "APA 7"
    });

    retryTaskFromFailure({
      taskId: "task-observe-2",
      restartAt: "drafting",
      operatorId: "admin-1"
    });

    expect(getMetricCount("task_manual_retry")).toBe(1);
    expect(listWorkflowLogs()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        eventType: "manual_retry",
        userId: "user-pay-1",
        taskId: "task-observe-2",
        retryAttempt: 1
      })
    ]));
  });
});

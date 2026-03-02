import { describe, expect, it } from "vitest";
import { resetMetrics, getMetricCount } from "../../src/lib/observability/metrics";
import {
  listWorkflowLogs,
  resetWorkflowLogs
} from "../../src/lib/observability/logger";
import {
  completePaidOrder,
  createPaymentOrder,
  resetPaymentState,
  seedUserWallet
} from "../../src/lib/payments/repository";
import {
  saveTaskSummary,
  updateTaskStatus
} from "../../src/lib/tasks/repository";

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

  it("records a structured log and metric when a payment settles", () => {
    resetWorkflowLogs();
    resetMetrics();
    resetPaymentState();
    seedUserWallet("user-pay-1", {
      rechargeQuota: 0,
      subscriptionQuota: 0,
      frozenQuota: 0
    });
    createPaymentOrder({
      id: "order-observe-1",
      userId: "user-pay-1",
      provider: "stripe",
      amountUsd: 19,
      quotaAmount: 20,
      kind: "recharge"
    });

    completePaidOrder({
      orderId: "order-observe-1",
      providerPaymentId: "cs_test_observe_1"
    });

    expect(getMetricCount("payment_paid")).toBe(1);
    expect(listWorkflowLogs()).toEqual([
      expect.objectContaining({
        eventType: "payment_event",
        userId: "user-pay-1",
        providerEventId: "cs_test_observe_1",
        orderId: "order-observe-1"
      })
    ]);
  });
});

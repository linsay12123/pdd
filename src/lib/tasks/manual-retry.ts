import { logManualRetry } from "@/src/lib/observability/logger";
import { recordRetryAttempt } from "@/src/lib/observability/metrics";
import { getTaskSummary, updateTaskStatus } from "@/src/lib/tasks/repository";
import type { TaskStatus } from "@/src/types/tasks";

export type ManualRetryAuditEntry = {
  taskId: string;
  operatorId: string;
  action: "manual_retry";
  createdAt: string;
  note: string;
};

export type ManualRetryResult = {
  taskId: string;
  previousStatus: TaskStatus;
  nextStatus: TaskStatus;
  quotaRecharged: false;
  retryAttempt: number;
  auditEntry: ManualRetryAuditEntry;
};

const safeRestartStatuses: TaskStatus[] = [
  "extracting_files",
  "building_rule_card",
  "drafting",
  "adjusting_word_count",
  "verifying_references",
  "exporting",
  "humanizing"
];

const manualRetryAuditStore: ManualRetryAuditEntry[] = [];

export function retryTaskFromFailure(input: {
  taskId: string;
  restartAt: TaskStatus;
  operatorId: string;
}): ManualRetryResult {
  const task = getTaskSummary(input.taskId);

  if (!task) {
    throw new Error("Task not found");
  }

  if (task.status !== "failed") {
    throw new Error("Only failed tasks can be retried");
  }

  if (!safeRestartStatuses.includes(input.restartAt)) {
    throw new Error("This step cannot be used as a retry starting point");
  }

  const retryAttempt = recordRetryAttempt(input.taskId);
  const nextTask = updateTaskStatus(input.taskId, input.restartAt);

  if (!nextTask) {
    throw new Error("Task not found");
  }

  const auditEntry: ManualRetryAuditEntry = {
    taskId: input.taskId,
    operatorId: input.operatorId,
    action: "manual_retry",
    createdAt: new Date().toISOString(),
    note:
      `Operator ${input.operatorId} restarted task ${input.taskId} ` +
      `from failed to ${input.restartAt} without recharging quota. ` +
      `Retry attempt ${retryAttempt}.`
  };

  manualRetryAuditStore.push(auditEntry);
  logManualRetry({
    taskId: input.taskId,
    userId: task.userId ?? "unknown",
    oldStatus: task.status,
    newStatus: input.restartAt,
    retryAttempt,
    note: auditEntry.note
  });

  return {
    taskId: input.taskId,
    previousStatus: task.status,
    nextStatus: nextTask.status,
    quotaRecharged: false,
    retryAttempt,
    auditEntry
  };
}

export function listManualRetryAuditEntries() {
  return [...manualRetryAuditStore];
}

export function resetManualRetryAuditStore() {
  manualRetryAuditStore.length = 0;
}

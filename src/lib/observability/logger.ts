import type { PaymentProvider } from "@/src/types/billing";
import type { TaskStatus } from "@/src/types/tasks";

export type WorkflowLogEntry = {
  eventType: "task_transition" | "payment_event" | "manual_retry";
  createdAt: string;
  taskId?: string;
  orderId?: string;
  userId?: string;
  oldStatus?: TaskStatus;
  newStatus?: TaskStatus;
  provider?: PaymentProvider;
  providerEventId?: string;
  retryAttempt?: number;
  note?: string;
};

const workflowLogStore: WorkflowLogEntry[] = [];

function appendWorkflowLog(
  entry: Omit<WorkflowLogEntry, "createdAt">
) {
  const nextEntry: WorkflowLogEntry = {
    createdAt: new Date().toISOString(),
    ...entry
  };

  workflowLogStore.push(nextEntry);
  return nextEntry;
}

export function logTaskTransition(input: {
  taskId: string;
  userId?: string;
  oldStatus: TaskStatus;
  newStatus: TaskStatus;
  note?: string;
}) {
  return appendWorkflowLog({
    eventType: "task_transition",
    ...input
  });
}

export function logPaymentEvent(input: {
  orderId: string;
  userId: string;
  provider: PaymentProvider;
  providerEventId: string;
  note?: string;
}) {
  return appendWorkflowLog({
    eventType: "payment_event",
    ...input
  });
}

export function logManualRetry(input: {
  taskId: string;
  userId?: string;
  oldStatus: TaskStatus;
  newStatus: TaskStatus;
  retryAttempt: number;
  note: string;
}) {
  return appendWorkflowLog({
    eventType: "manual_retry",
    ...input
  });
}

export function listWorkflowLogs() {
  return [...workflowLogStore];
}

export function resetWorkflowLogs() {
  workflowLogStore.length = 0;
}

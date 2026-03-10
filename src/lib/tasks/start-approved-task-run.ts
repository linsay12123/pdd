import "server-only";

type ApprovedTaskRunInput = {
  taskId: string;
  userId: string;
  safetyIdentifier: string;
  approvalAttemptCount: number;
};

type ApprovedTaskStartupCheckInput = {
  taskId: string;
  userId: string;
  approvalAttemptCount: number;
  triggerRunId: string;
};

export async function enqueueApprovedTaskRun(input: ApprovedTaskRunInput) {
  const { tasks } = await import("@trigger.dev/sdk/v3");
  const handle = await tasks.trigger("process-approved-task", input, {
    queue: "process-approved-task",
    concurrencyKey: `process-approved-task-${input.taskId}`,
    idempotencyKey: `process-approved-task-${input.taskId}-attempt-${input.approvalAttemptCount}`
  });

  return typeof handle?.id === "string" ? handle.id : null;
}

export async function enqueueApprovedTaskStartupCheck(
  input: ApprovedTaskStartupCheckInput
) {
  const { tasks } = await import("@trigger.dev/sdk/v3");
  const handle = await tasks.trigger("verify-approved-task-startup", input, {
    queue: "process-approved-task-startup-check",
    concurrencyKey: `process-approved-task-startup-check-${input.taskId}`,
    idempotencyKey: `process-approved-task-startup-check-${input.taskId}-attempt-${input.approvalAttemptCount}`
  });

  return typeof handle?.id === "string" ? handle.id : null;
}

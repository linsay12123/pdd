import "server-only";

import { finalizeApprovedTaskStartupFailure } from "@/src/lib/tasks/finalize-approved-task-startup-failure";
import { resolveTriggerRunState } from "@/src/lib/trigger/run-state";
import {
  WORKFLOW_STARTUP_PENDING_VERSION_MESSAGE,
  WORKFLOW_STARTUP_STALLED_MESSAGE
} from "@/src/lib/tasks/workflow-runtime-errors";

type VerifyApprovedTaskStartupInput = {
  taskId: string;
  userId: string;
  approvalAttemptCount: number;
  triggerRunId: string;
};

type VerifyApprovedTaskStartupDependencies = {
  resolveRunState?: typeof resolveTriggerRunState;
  finalizeFailure?: typeof finalizeApprovedTaskStartupFailure;
  sleep?: (ms: number) => Promise<void>;
};

const POLL_INTERVAL_MS = 2_000;
const MAX_WAIT_MS = 30_000;

export async function verifyApprovedTaskStartup(
  input: VerifyApprovedTaskStartupInput,
  dependencies: VerifyApprovedTaskStartupDependencies = {}
) {
  const resolveRunState = dependencies.resolveRunState ?? resolveTriggerRunState;
  const finalizeFailure = dependencies.finalizeFailure ?? finalizeApprovedTaskStartupFailure;
  const sleep = dependencies.sleep ?? defaultSleep;

  const startedAt = Date.now();

  while (Date.now() - startedAt <= MAX_WAIT_MS) {
    const runtime = await resolveRunState(input.triggerRunId);

    if (runtime.state === "pending_version") {
      await finalizeFailure({
        taskId: input.taskId,
        userId: input.userId,
        expectedApprovalAttemptCount: input.approvalAttemptCount,
        mode: "fail",
        failureMessage: WORKFLOW_STARTUP_PENDING_VERSION_MESSAGE
      });

      return {
        ok: false,
        state: runtime.state,
        status: runtime.status,
        message: WORKFLOW_STARTUP_PENDING_VERSION_MESSAGE
      } as const;
    }

    if (runtime.state === "active" || runtime.state === "terminal") {
      return {
        ok: true,
        state: runtime.state,
        status: runtime.status,
        message: "后台正文任务已经真正启动。"
      } as const;
    }

    await sleep(POLL_INTERVAL_MS);
  }

  await finalizeFailure({
    taskId: input.taskId,
    userId: input.userId,
    expectedApprovalAttemptCount: input.approvalAttemptCount,
    mode: "fail",
    failureMessage: WORKFLOW_STARTUP_STALLED_MESSAGE
  });

  return {
    ok: false,
    state: "unknown",
    status: null,
    message: WORKFLOW_STARTUP_STALLED_MESSAGE
  } as const;
}

function defaultSleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

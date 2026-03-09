import { tasks } from "@trigger.dev/sdk/v3";
import { resolveTriggerRunState } from "@/src/lib/trigger/run-state";
import {
  TRIGGER_DEPLOYMENT_UNAVAILABLE_REASON,
  TRIGGER_STARTUP_STALLED_REASON
} from "@/src/lib/tasks/analysis-runtime-cleanup";
import type { TriggerRunRuntimeState } from "@/src/lib/trigger/run-state";

type ApprovedTaskTriggerInput = {
  taskId: string;
  userId: string;
  safetyIdentifier: string;
  approvalAttemptCount: number;
};

type TriggerRuntimeSnapshot = {
  state: TriggerRunRuntimeState;
  status: string | null;
};

type StartApprovedTaskRunInput = {
  taskId: string;
  userId: string;
  safetyIdentifier: string;
  approvalAttemptCount: number;
  enqueueApprovedTaskProcessing?: (
    input: ApprovedTaskTriggerInput
  ) => Promise<string | null>;
  getTriggerRunState?: (runId: string) => Promise<TriggerRuntimeSnapshot>;
  startupProbeAttempts?: number;
  startupProbeDelayMs?: number;
  sleepImpl?: (ms: number) => Promise<void>;
};

export type StartApprovedTaskRunResult =
  | {
      ok: true;
      triggerRunId: string;
      runtime: TriggerRuntimeSnapshot;
      detail: string;
    }
  | {
      ok: false;
      triggerRunId: string | null;
      runtime: TriggerRuntimeSnapshot;
      reason: string;
      message: string;
      detail: string;
    };

export async function startApprovedTaskRun(
  input: StartApprovedTaskRunInput
): Promise<StartApprovedTaskRunResult> {
  const enqueueApprovedTaskProcessing =
    input.enqueueApprovedTaskProcessing ?? enqueueApprovedTaskProcessingWithTrigger;
  const getTriggerRunState = input.getTriggerRunState ?? resolveTriggerRunState;

  const triggerRunId = await enqueueApprovedTaskProcessing({
    taskId: input.taskId,
    userId: input.userId,
    safetyIdentifier: input.safetyIdentifier,
    approvalAttemptCount: input.approvalAttemptCount
  });

  if (!triggerRunId) {
    return {
      ok: false,
      triggerRunId: null,
      runtime: {
        state: "unknown",
        status: null
      },
      reason: TRIGGER_STARTUP_STALLED_REASON,
      message: "后台正文任务没有真正启动成功，请稍后重试。",
      detail: "系统没有拿到正文任务的运行编号，所以这次正文任务并没有真正开始。"
    };
  }

  const startup = await confirmRunStartup({
    runId: triggerRunId,
    getTriggerRunState,
    startupProbeAttempts: input.startupProbeAttempts,
    startupProbeDelayMs: input.startupProbeDelayMs,
    sleepImpl: input.sleepImpl
  });

  if (startup.accepted) {
    return {
      ok: true,
      triggerRunId,
      runtime: startup.runtime,
      detail: startup.detail
    };
  }

  return {
    ok: false,
    triggerRunId,
    runtime: startup.runtime,
    reason: startup.reason,
    message:
      startup.reason === TRIGGER_DEPLOYMENT_UNAVAILABLE_REASON
        ? "后台正文任务版本还没准备好，请稍后重试。"
        : "后台正文任务没有真正启动成功，请稍后重试。",
    detail: startup.detail
  };
}

async function enqueueApprovedTaskProcessingWithTrigger(
  input: ApprovedTaskTriggerInput
) {
  const handle = await tasks.trigger("process-approved-task", input, {
    queue: "process-approved-task",
    concurrencyKey: `process-approved-task-${input.taskId}`,
    idempotencyKey: `process-approved-task-${input.taskId}-attempt-${input.approvalAttemptCount}`
  });

  return typeof handle?.id === "string" ? handle.id : null;
}

async function confirmRunStartup(input: {
  runId: string;
  getTriggerRunState: (runId: string) => Promise<TriggerRuntimeSnapshot>;
  startupProbeAttempts?: number;
  startupProbeDelayMs?: number;
  sleepImpl?: (ms: number) => Promise<void>;
}): Promise<{
  accepted: boolean;
  runtime: TriggerRuntimeSnapshot;
  reason: string;
  detail: string;
}> {
  const attempts =
    Number.isFinite(input.startupProbeAttempts) && (input.startupProbeAttempts ?? 0) > 0
      ? Number(input.startupProbeAttempts)
      : 4;
  const delayMs =
    Number.isFinite(input.startupProbeDelayMs) && (input.startupProbeDelayMs ?? 0) >= 0
      ? Number(input.startupProbeDelayMs)
      : process.env.NODE_ENV === "test"
        ? 0
        : 1_000;
  const sleepImpl = input.sleepImpl ?? sleep;

  let lastRuntime: TriggerRuntimeSnapshot = {
    state: "unknown",
    status: null
  };

  for (let index = 0; index < attempts; index += 1) {
    const runtime = await Promise.resolve(input.getTriggerRunState(input.runId)).catch(
      (): TriggerRuntimeSnapshot => ({
        state: "unknown",
        status: null
      })
    );

    lastRuntime = normalizeRuntime(runtime);

    if (lastRuntime.state === "active") {
      return {
        accepted: true,
        runtime: lastRuntime,
        reason: "",
        detail: "后台正文任务已经真正开始执行。"
      };
    }

    if (index < attempts - 1 && delayMs > 0) {
      await sleepImpl(delayMs);
    }
  }

  return {
    accepted: false,
    runtime: lastRuntime,
    reason:
      lastRuntime.state === "pending_version"
        ? TRIGGER_DEPLOYMENT_UNAVAILABLE_REASON
        : TRIGGER_STARTUP_STALLED_REASON,
    detail:
      lastRuntime.state === "pending_version"
        ? "后台当前没有可执行版本，正文任务一直停在等待接版本。"
        : "后台正文任务没有在启动窗口内真正开始执行。"
  };
}

function normalizeRuntime(runtime: Partial<TriggerRuntimeSnapshot> | null | undefined) {
  if (
    runtime?.state === "active" ||
    runtime?.state === "pending_version" ||
    runtime?.state === "terminal" ||
    runtime?.state === "missing" ||
    runtime?.state === "unknown"
  ) {
    return {
      state: runtime.state,
      status: typeof runtime.status === "string" ? runtime.status : null
    } satisfies TriggerRuntimeSnapshot;
  }

  return {
    state: "unknown",
    status: null
  } satisfies TriggerRuntimeSnapshot;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

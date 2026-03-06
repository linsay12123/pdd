import type { TriggerRunRuntimeState } from "@/src/lib/trigger/run-state";
import {
  normalizeAnalysisModel,
  TRIGGER_DEPLOYMENT_UNAVAILABLE_REASON,
  TRIGGER_RUNTIME_UNAVAILABLE_REASON
} from "@/src/lib/tasks/analysis-runtime-cleanup";
import type { TaskSummary } from "@/src/types/tasks";

type AnalysisTriggerInput = {
  taskId: string;
  userId: string;
  forcedPrimaryFileId?: string | null;
  idempotencyKey: string;
};

type TriggerRuntimeSnapshot = {
  state: TriggerRunRuntimeState;
  status: string | null;
};

type StartTaskAnalysisRunInput = {
  task: TaskSummary;
  userId: string;
  source: "upload" | "confirm_primary" | "manual_retry";
  forcedPrimaryFileId?: string | null;
  enqueueTaskAnalysis: (input: AnalysisTriggerInput) => Promise<string | null>;
  getTriggerRunState: (runId: string) => Promise<TriggerRuntimeSnapshot>;
  markTaskAnalysisPending: (input: {
    taskId: string;
    userId: string;
    primaryRequirementFileId?: string | null;
    triggerRunId?: string | null;
    analysisModel?: string | null;
    analysisRetryCount?: number;
  }) => Promise<unknown>;
  markTaskAnalysisFailed: (input: {
    taskId: string;
    userId: string;
    reason: string;
    analysisRetryCount?: number;
  }) => Promise<unknown>;
  startupProbeAttempts?: number;
  startupProbeDelayMs?: number;
  sleepImpl?: (ms: number) => Promise<void>;
};

type StartTaskAnalysisRunResult =
  | {
      ok: true;
      triggerRunId: string;
      runtime: TriggerRuntimeSnapshot;
      autoRecovered: boolean;
      analysisRetryCount: number;
      analysisModel: string;
    }
  | {
      ok: false;
      reason: string;
      triggerRunId: string | null;
      runtime: TriggerRuntimeSnapshot;
      autoRecovered: boolean;
      analysisRetryCount: number;
      analysisModel: string;
    };

export async function startTaskAnalysisRun(
  input: StartTaskAnalysisRunInput
): Promise<StartTaskAnalysisRunResult> {
  const analysisModel = normalizeAnalysisModel(input.task.analysisModel ?? "gpt-5.2");
  const firstAttemptRetryCount = computeFirstAttemptRetryCount(input.task, input.source);

  const firstAttempt = await enqueueAndInspectRun({
    taskId: input.task.id,
    userId: input.userId,
    forcedPrimaryFileId: input.forcedPrimaryFileId ?? null,
    analysisRetryCount: firstAttemptRetryCount,
    source: input.source,
    enqueueTaskAnalysis: input.enqueueTaskAnalysis,
    getTriggerRunState: input.getTriggerRunState,
    startupProbeAttempts: input.startupProbeAttempts,
    startupProbeDelayMs: input.startupProbeDelayMs,
    sleepImpl: input.sleepImpl
  });

  if (firstAttempt.accepted) {
    await input.markTaskAnalysisPending({
      taskId: input.task.id,
      userId: input.userId,
      primaryRequirementFileId: input.forcedPrimaryFileId,
      triggerRunId: firstAttempt.triggerRunId,
      analysisModel,
      analysisRetryCount: firstAttemptRetryCount
    });

    return {
      ok: true,
      triggerRunId: firstAttempt.triggerRunId,
      runtime: normalizeAcceptedRuntime(firstAttempt.runtime),
      autoRecovered: false,
      analysisRetryCount: firstAttemptRetryCount,
      analysisModel
    };
  }

  if (firstAttempt.reason === TRIGGER_DEPLOYMENT_UNAVAILABLE_REASON) {
    await input.markTaskAnalysisFailed({
      taskId: input.task.id,
      userId: input.userId,
      reason: firstAttempt.reason,
      analysisRetryCount: firstAttemptRetryCount
    });

    return {
      ok: false,
      reason: firstAttempt.reason,
      triggerRunId: firstAttempt.triggerRunId,
      runtime: firstAttempt.runtime,
      autoRecovered: false,
      analysisRetryCount: firstAttemptRetryCount,
      analysisModel
    };
  }

  const recoveredRetryCount = firstAttemptRetryCount + 1;
  const recoveredAttempt = await enqueueAndInspectRun({
    taskId: input.task.id,
    userId: input.userId,
    forcedPrimaryFileId: input.forcedPrimaryFileId ?? null,
    analysisRetryCount: recoveredRetryCount,
    source: input.source,
    enqueueTaskAnalysis: input.enqueueTaskAnalysis,
    getTriggerRunState: input.getTriggerRunState,
    startupProbeAttempts: input.startupProbeAttempts,
    startupProbeDelayMs: input.startupProbeDelayMs,
    sleepImpl: input.sleepImpl
  });

  if (recoveredAttempt.accepted) {
    await input.markTaskAnalysisPending({
      taskId: input.task.id,
      userId: input.userId,
      primaryRequirementFileId: input.forcedPrimaryFileId,
      triggerRunId: recoveredAttempt.triggerRunId,
      analysisModel,
      analysisRetryCount: recoveredRetryCount
    });

    return {
      ok: true,
      triggerRunId: recoveredAttempt.triggerRunId,
      runtime: normalizeAcceptedRuntime(recoveredAttempt.runtime),
      autoRecovered: true,
      analysisRetryCount: recoveredRetryCount,
      analysisModel
    };
  }

  await input.markTaskAnalysisFailed({
    taskId: input.task.id,
    userId: input.userId,
    reason: recoveredAttempt.reason ?? TRIGGER_RUNTIME_UNAVAILABLE_REASON,
    analysisRetryCount: recoveredRetryCount
  });

  return {
    ok: false,
    reason: recoveredAttempt.reason ?? TRIGGER_RUNTIME_UNAVAILABLE_REASON,
    triggerRunId: recoveredAttempt.triggerRunId,
    runtime: recoveredAttempt.runtime,
    autoRecovered: true,
    analysisRetryCount: recoveredRetryCount,
    analysisModel
  };
}

function computeFirstAttemptRetryCount(
  task: Pick<TaskSummary, "analysisRetryCount" | "analysisRequestedAt" | "analysisTriggerRunId">,
  source: StartTaskAnalysisRunInput["source"]
) {
  const current = Number(task.analysisRetryCount ?? 0);
  const hasExistingAnalysisTrace = Boolean(
    task.analysisRequestedAt?.trim() || task.analysisTriggerRunId?.trim()
  );

  if (source === "upload" && !hasExistingAnalysisTrace) {
    return current;
  }

  return current + 1;
}

async function enqueueAndInspectRun(input: {
  taskId: string;
  userId: string;
  forcedPrimaryFileId?: string | null;
  analysisRetryCount: number;
  source: StartTaskAnalysisRunInput["source"];
  enqueueTaskAnalysis: StartTaskAnalysisRunInput["enqueueTaskAnalysis"];
  getTriggerRunState: StartTaskAnalysisRunInput["getTriggerRunState"];
  startupProbeAttempts?: number;
  startupProbeDelayMs?: number;
  sleepImpl?: (ms: number) => Promise<void>;
}) {
  const triggerRunId = await input.enqueueTaskAnalysis({
    taskId: input.taskId,
    userId: input.userId,
    forcedPrimaryFileId: input.forcedPrimaryFileId ?? null,
    idempotencyKey: buildAnalysisRunIdempotencyKey({
      taskId: input.taskId,
      analysisRetryCount: input.analysisRetryCount,
      source: input.source,
      forcedPrimaryFileId: input.forcedPrimaryFileId ?? null
    })
  });

  if (!triggerRunId) {
    throw new Error("TRIGGER_RUN_ID_MISSING");
  }

  const runtime = await confirmRunStartup({
    runId: triggerRunId,
    getTriggerRunState: input.getTriggerRunState,
    startupProbeAttempts: input.startupProbeAttempts,
    startupProbeDelayMs: input.startupProbeDelayMs,
    sleepImpl: input.sleepImpl
  });

  return {
    triggerRunId,
    runtime: normalizeRuntimeSnapshot(runtime.runtime),
    accepted: runtime.accepted,
    reason: runtime.reason
  };
}

function buildAnalysisRunIdempotencyKey(input: {
  taskId: string;
  analysisRetryCount: number;
  source: StartTaskAnalysisRunInput["source"];
  forcedPrimaryFileId?: string | null;
}) {
  const primaryPart = input.forcedPrimaryFileId
    ? `-primary-${sanitizeKeyPart(input.forcedPrimaryFileId)}`
    : "";

  return `task-analysis-${input.taskId}-${input.source}-attempt-${input.analysisRetryCount}${primaryPart}`;
}

function sanitizeKeyPart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64);
}

function normalizeAcceptedRuntime(runtime: TriggerRuntimeSnapshot): TriggerRuntimeSnapshot {
  return {
    state: "active",
    status: runtime.status ?? "QUEUED"
  };
}

function normalizeRuntimeSnapshot(
  runtime: Partial<TriggerRuntimeSnapshot> | null | undefined
): TriggerRuntimeSnapshot {
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
    };
  }

  return {
    state: "unknown",
    status: null
  };
}

async function confirmRunStartup(input: {
  runId: string;
  getTriggerRunState: StartTaskAnalysisRunInput["getTriggerRunState"];
  startupProbeAttempts?: number;
  startupProbeDelayMs?: number;
  sleepImpl?: (ms: number) => Promise<void>;
}): Promise<{
  accepted: boolean;
  runtime: TriggerRuntimeSnapshot;
  reason: string | null;
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
        : 2_000;
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
    const normalizedRuntime = normalizeRuntimeSnapshot(runtime);

    // 一旦已经看到 Trigger 明确返回过 pending_version，就不要让后续的 unknown
    // 把这条线索冲掉，否则会把“版本没就绪”误判成“普通未知异常”。
    if (!(normalizedRuntime.state === "unknown" && lastRuntime.state === "pending_version")) {
      lastRuntime = normalizedRuntime;
    }

    if (isAcceptedStartupState(lastRuntime.state)) {
      return {
        accepted: true,
        runtime: lastRuntime,
        reason: null
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
        : TRIGGER_RUNTIME_UNAVAILABLE_REASON
  };
}

function isAcceptedStartupState(state: TriggerRunRuntimeState) {
  return state === "active";
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

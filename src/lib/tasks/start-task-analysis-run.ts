import type { TriggerRunRuntimeState } from "@/src/lib/trigger/run-state";
import {
  normalizeAnalysisModel,
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
  }) => Promise<unknown>;
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
  const startingRetryCount = Number(input.task.analysisRetryCount ?? 0);
  const firstAttemptRetryCount = computeFirstAttemptRetryCount(input.task, input.source);

  const firstAttempt = await enqueueAndInspectRun({
    taskId: input.task.id,
    userId: input.userId,
    forcedPrimaryFileId: input.forcedPrimaryFileId ?? null,
    analysisRetryCount: firstAttemptRetryCount,
    source: input.source,
    enqueueTaskAnalysis: input.enqueueTaskAnalysis,
    getTriggerRunState: input.getTriggerRunState
  });

  if (!isClearlyBrokenFreshRun(firstAttempt.runtime.state)) {
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

  const recoveredRetryCount = firstAttemptRetryCount + 1;
  const recoveredAttempt = await enqueueAndInspectRun({
    taskId: input.task.id,
    userId: input.userId,
    forcedPrimaryFileId: input.forcedPrimaryFileId ?? null,
    analysisRetryCount: recoveredRetryCount,
    source: input.source,
    enqueueTaskAnalysis: input.enqueueTaskAnalysis,
    getTriggerRunState: input.getTriggerRunState
  });

  if (!isClearlyBrokenFreshRun(recoveredAttempt.runtime.state)) {
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
    reason: TRIGGER_RUNTIME_UNAVAILABLE_REASON
  });

  return {
    ok: false,
    reason: TRIGGER_RUNTIME_UNAVAILABLE_REASON,
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

  const runtime = await input.getTriggerRunState(triggerRunId).catch(
    (): TriggerRuntimeSnapshot => ({
      state: "unknown",
      status: null
    })
  );

  return {
    triggerRunId,
    runtime: normalizeRuntimeSnapshot(runtime)
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
  if (runtime.state === "unknown") {
    return runtime;
  }

  return {
    state: "active",
    status: runtime.status ?? "QUEUED"
  };
}

function isClearlyBrokenFreshRun(state: TriggerRunRuntimeState) {
  return state === "pending_version" || state === "missing" || state === "terminal";
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

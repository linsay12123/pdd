export const STALE_TRIGGER_RUN_REASON = "STALE_TRIGGER_RUN";
export const TRIGGER_RUNTIME_UNAVAILABLE_REASON = "TRIGGER_RUNTIME_UNAVAILABLE";
export const TRIGGER_STARTUP_STALLED_REASON = "TRIGGER_STARTUP_STALLED";

const LEGACY_ANALYSIS_MODEL_MARKER = "analysis_auto_recovered_once";
const DEFAULT_ANALYSIS_MODEL = "gpt-5.2";

export function normalizeAnalysisModel(model?: string | null) {
  const value = typeof model === "string" ? model.trim() : "";

  if (!value || value === LEGACY_ANALYSIS_MODEL_MARKER) {
    return DEFAULT_ANALYSIS_MODEL;
  }

  return value;
}

export function buildStaleTriggerRunRepairPatch(input: {
  analysisModel?: string | null;
  reason?: string;
  now?: Date;
}) {
  const reason = input.reason ?? STALE_TRIGGER_RUN_REASON;
  return {
    analysisStatus: "failed" as const,
    analysisModel: normalizeAnalysisModel(input.analysisModel),
    analysisErrorMessage: reason,
    analysisTriggerRunId: null,
    analysisStartedAt: null,
    analysisCompletedAt: (input.now ?? new Date()).toISOString(),
    analysisSnapshot: null
  };
}

export function shouldClearBrokenTriggerRun(reason: string) {
  return (
    reason === STALE_TRIGGER_RUN_REASON ||
    reason === TRIGGER_RUNTIME_UNAVAILABLE_REASON ||
    reason === TRIGGER_STARTUP_STALLED_REASON
  );
}

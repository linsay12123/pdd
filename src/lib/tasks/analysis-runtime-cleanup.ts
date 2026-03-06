export const STALE_TRIGGER_RUN_REASON = "STALE_TRIGGER_RUN";

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
  now?: Date;
}) {
  return {
    analysisStatus: "failed" as const,
    analysisModel: normalizeAnalysisModel(input.analysisModel),
    analysisErrorMessage: STALE_TRIGGER_RUN_REASON,
    analysisTriggerRunId: null,
    analysisStartedAt: null,
    analysisCompletedAt: (input.now ?? new Date()).toISOString(),
    analysisSnapshot: null
  };
}

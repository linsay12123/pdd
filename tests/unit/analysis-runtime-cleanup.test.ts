import { describe, expect, it } from "vitest";
import {
  buildStaleTriggerRunRepairPatch,
  normalizeAnalysisModel,
  STALE_TRIGGER_RUN_REASON
} from "../../src/lib/tasks/analysis-runtime-cleanup";

describe("analysis runtime cleanup helpers", () => {
  it("normalizes legacy or empty analysis model values back to gpt-5.2", () => {
    expect(normalizeAnalysisModel(null)).toBe("gpt-5.2");
    expect(normalizeAnalysisModel("")).toBe("gpt-5.2");
    expect(normalizeAnalysisModel("analysis_auto_recovered_once")).toBe("gpt-5.2");
    expect(normalizeAnalysisModel("gpt-5.2")).toBe("gpt-5.2");
  });

  it("builds a stale trigger repair patch that clears the broken run id but keeps the task", () => {
    const patch = buildStaleTriggerRunRepairPatch({
      analysisModel: "analysis_auto_recovered_once",
      now: new Date("2026-03-06T00:00:00.000Z")
    });

    expect(patch).toEqual({
      analysisStatus: "failed",
      analysisModel: "gpt-5.2",
      analysisErrorMessage: STALE_TRIGGER_RUN_REASON,
      analysisTriggerRunId: null,
      analysisStartedAt: null,
      analysisCompletedAt: "2026-03-06T00:00:00.000Z",
      analysisSnapshot: null
    });
  });
});

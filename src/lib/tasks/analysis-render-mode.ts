import type {
  TaskAnalysisRenderMode,
  TaskAnalysisSnapshot,
  TaskProviderErrorKind
} from "@/src/types/tasks";

type AnalysisDisplayStateInput = {
  analysis: TaskAnalysisSnapshot | null | undefined;
  analysisRenderMode?: TaskAnalysisRenderMode | "raw" | null;
  rawModelResponse?: string | null;
  providerStatusCode?: number | null;
  providerErrorBody?: string | null;
  providerErrorKind?: TaskProviderErrorKind | null;
};

export function resolveTaskAnalysisRenderMode(
  analysis: TaskAnalysisSnapshot | null | undefined
): TaskAnalysisRenderMode | null {
  if (!analysis) {
    return null;
  }

  const explicitMode = normalizeRenderMode(analysis.analysisRenderMode ?? null);
  if (explicitMode) {
    return explicitMode;
  }

  if (analysis.providerErrorBody?.trim()) {
    return "raw_provider_error";
  }

  if (analysis.providerErrorKind) {
    return "system_error";
  }

  if (analysis.rawModelResponse?.trim()) {
    return "raw_model";
  }

  return "structured";
}

export function getTaskAnalysisDisplayState(input: AnalysisDisplayStateInput) {
  const analysisRenderMode =
    normalizeRenderMode(input.analysisRenderMode ?? null) ??
    resolveTaskAnalysisRenderMode(input.analysis);

  return {
    analysisRenderMode,
    rawModelResponse: normalizeText(input.rawModelResponse) ?? normalizeText(input.analysis?.rawModelResponse),
    providerStatusCode: normalizeStatusCode(input.providerStatusCode) ?? normalizeStatusCode(input.analysis?.providerStatusCode),
    providerErrorBody:
      normalizeText(input.providerErrorBody) ?? normalizeText(input.analysis?.providerErrorBody),
    providerErrorKind:
      normalizeProviderErrorKind(input.providerErrorKind) ??
      normalizeProviderErrorKind(input.analysis?.providerErrorKind)
  };
}

function normalizeRenderMode(
  value: TaskAnalysisRenderMode | "raw" | null | undefined
): TaskAnalysisRenderMode | null {
  if (
    value === "structured" ||
    value === "raw_model" ||
    value === "raw_provider_error" ||
    value === "system_error"
  ) {
    return value;
  }

  if (value === "raw") {
    return "raw_model";
  }

  return null;
}

function normalizeProviderErrorKind(
  value: TaskProviderErrorKind | null | undefined
): TaskProviderErrorKind | null {
  if (value === "http_error" || value === "transport_error" || value === "timeout") {
    return value;
  }

  return null;
}

function normalizeText(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized ? normalized : null;
}

function normalizeStatusCode(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

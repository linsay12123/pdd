export const ANALYSIS_MAX_WAIT_SECONDS = 10 * 60;
export const ANALYSIS_POLL_INTERVAL_MS = 30_000;

export type AnalysisStatus = "pending" | "succeeded" | "failed";

export type AnalysisProgressPayload = {
  requestedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  elapsedSeconds: number;
  maxWaitSeconds: number;
  canRetry: boolean;
};

export function buildAnalysisProgressPayload(input: {
  status: AnalysisStatus;
  requestedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  now?: Date;
}): AnalysisProgressPayload {
  const now = input.now ?? new Date();
  const requestedAt = normalizeIso(input.requestedAt);
  const startedAt = normalizeIso(input.startedAt);
  const completedAt = normalizeIso(input.completedAt);
  const elapsedSeconds = requestedAt
    ? Math.max(0, Math.floor((now.getTime() - new Date(requestedAt).getTime()) / 1000))
    : 0;
  const isPendingTimedOut =
    input.status === "pending" && elapsedSeconds >= ANALYSIS_MAX_WAIT_SECONDS;

  return {
    requestedAt,
    startedAt,
    completedAt,
    elapsedSeconds,
    maxWaitSeconds: ANALYSIS_MAX_WAIT_SECONDS,
    canRetry: input.status === "failed" || isPendingTimedOut
  };
}

export function formatElapsedMinutes(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  if (minutes <= 0) {
    return "不到 1 分钟";
  }

  return `${minutes} 分钟`;
}

function normalizeIso(value?: string | null) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}


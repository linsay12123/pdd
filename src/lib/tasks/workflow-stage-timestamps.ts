import type {
  TaskStatus,
  TaskSummary,
  TaskWorkflowStageTimestampKey
} from "@/src/types/tasks";

const trackedStatuses = new Set<TaskWorkflowStageTimestampKey>([
  "drafting",
  "adjusting_word_count",
  "verifying_references",
  "exporting",
  "deliverable_ready",
  "failed"
]);

function isTrackedWorkflowStatus(
  status: TaskStatus
): status is TaskWorkflowStageTimestampKey {
  return trackedStatuses.has(status as TaskWorkflowStageTimestampKey);
}

function normalizeTimestamp(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

export function normalizeWorkflowStageTimestamps(
  value: unknown
): TaskSummary["workflowStageTimestamps"] {
  if (!value || typeof value !== "object") {
    return {};
  }

  const next: TaskSummary["workflowStageTimestamps"] = {};

  for (const key of trackedStatuses) {
    const normalized = normalizeTimestamp((value as Record<string, unknown>)[key]);
    if (normalized) {
      next[key] = normalized;
    }
  }

  return next;
}

export function buildWorkflowStageTimestamps(input: {
  current?: TaskSummary["workflowStageTimestamps"] | null;
  status: TaskStatus;
  recordedAt?: string;
  reset?: boolean;
}): TaskSummary["workflowStageTimestamps"] {
  const next = input.reset
    ? {}
    : { ...normalizeWorkflowStageTimestamps(input.current ?? null) };

  if (!isTrackedWorkflowStatus(input.status)) {
    return next;
  }

  const recordedAt = normalizeTimestamp(input.recordedAt ?? new Date().toISOString());
  if (!recordedAt) {
    throw new Error("WORKFLOW_STAGE_TIMESTAMP_INVALID");
  }

  next[input.status] = recordedAt;
  return next;
}

export function isWorkflowStageTimestampsColumnMissingError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    message.includes("workflow_stage_timestamps") &&
    (message.includes("does not exist") || message.includes("42703"))
  );
}

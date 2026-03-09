import type { TaskSummary } from "@/src/types/tasks";
import type { TaskWorkflowHumanizePayload } from "@/src/lib/tasks/request-task-file-upload";

export type SessionTaskPayload = {
  id: string;
  status: TaskSummary["status"];
  targetWordCount: number | null;
  citationStyle: string | null;
  specialRequirements: string;
  lastWorkflowStage?: TaskSummary["lastWorkflowStage"] | null;
  workflowStageTimestamps?: TaskSummary["workflowStageTimestamps"];
};

export function toSessionTaskPayload(task: TaskSummary): SessionTaskPayload {
  return {
    id: task.id,
    status: task.status,
    targetWordCount: task.targetWordCount,
    citationStyle: task.citationStyle,
    specialRequirements: task.specialRequirements ?? "",
    lastWorkflowStage: task.lastWorkflowStage ?? null,
    workflowStageTimestamps: task.workflowStageTimestamps ?? {}
  };
}

export function toSessionTaskHumanizePayload(
  task: TaskSummary
): TaskWorkflowHumanizePayload {
  return {
    status: task.humanizeStatus ?? "idle",
    provider: task.humanizeProvider ?? null,
    requestedAt: task.humanizeRequestedAt ?? null,
    completedAt: task.humanizeCompletedAt ?? null,
    errorMessage: task.humanizeErrorMessage ?? null
  };
}

import type { TaskSummary } from "@/src/types/tasks";

export type SessionTaskPayload = {
  id: string;
  status: TaskSummary["status"];
  targetWordCount: number;
  citationStyle: string;
  specialRequirements: string;
};

export function toSessionTaskPayload(task: TaskSummary): SessionTaskPayload {
  return {
    id: task.id,
    status: task.status,
    targetWordCount: task.targetWordCount,
    citationStyle: task.citationStyle,
    specialRequirements: task.specialRequirements ?? ""
  };
}

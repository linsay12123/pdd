import {
  requestTaskCreate,
  type TaskCreatePayload
} from "@/src/lib/tasks/request-task-create";
import {
  requestTaskFileUpload,
  type TaskWorkflowPayload
} from "@/src/lib/tasks/request-task-file-upload";

export type TaskBootstrapPayload = TaskWorkflowPayload & {
  frozenQuota: TaskCreatePayload["frozenQuota"];
};

type RequestTaskBootstrapInput = {
  specialRequirements: string;
  files: File[];
  targetWordCount?: number;
  citationStyle?: string;
  fetchImpl?: typeof fetch;
};

export async function requestTaskBootstrap({
  specialRequirements,
  files,
  targetWordCount,
  citationStyle,
  fetchImpl = fetch
}: RequestTaskBootstrapInput): Promise<TaskBootstrapPayload> {
  const createdTask = await requestTaskCreate({
    specialRequirements,
    targetWordCount,
    citationStyle,
    fetchImpl
  });
  const uploadedTask = await requestTaskFileUpload({
    taskId: createdTask.task.id,
    files,
    fetchImpl
  });

  return {
    ...uploadedTask,
    frozenQuota: createdTask.frozenQuota
  };
}

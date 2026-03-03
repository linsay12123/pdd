import {
  requestTaskCreate,
  type TaskCreatePayload
} from "@/src/lib/tasks/request-task-create";
import {
  requestTaskFileUpload,
  type TaskWorkflowPayload
} from "@/src/lib/tasks/request-task-file-upload";
import { requestTaskCancel } from "@/src/lib/tasks/request-task-cancel";

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

  let uploadedTask: TaskWorkflowPayload;
  try {
    uploadedTask = await requestTaskFileUpload({
      taskId: createdTask.task.id,
      files,
      fetchImpl
    });
  } catch (uploadError) {
    // Best-effort: cancel the task and release frozen quota
    await requestTaskCancel({
      taskId: createdTask.task.id,
      fetchImpl
    }).catch(() => {});
    throw uploadError;
  }

  return {
    ...uploadedTask,
    frozenQuota: createdTask.frozenQuota
  };
}

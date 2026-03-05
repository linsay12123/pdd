import type { TaskWorkflowPayload } from "@/src/lib/tasks/request-task-file-upload";

type RequestTaskAnalysisRetryInput = {
  taskId: string;
  fetchImpl?: typeof fetch;
};

export async function requestTaskAnalysisRetry({
  taskId,
  fetchImpl = fetch
}: RequestTaskAnalysisRetryInput): Promise<TaskWorkflowPayload> {
  const response = await fetchImpl(`/api/tasks/${taskId}/analysis/retry`, {
    method: "POST"
  });
  const payload = (await response.json().catch(() => null)) as
    | TaskWorkflowPayload
    | { message?: string }
    | null;

  if (!response.ok) {
    throw new Error(payload?.message ?? "重试分析失败，请稍后再试");
  }

  return payload as TaskWorkflowPayload;
}


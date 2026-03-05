import type { TaskWorkflowPayload } from "@/src/lib/tasks/request-task-file-upload";

type RequestTaskAnalysisStatusInput = {
  taskId: string;
  fetchImpl?: typeof fetch;
};

export async function requestTaskAnalysisStatus({
  taskId,
  fetchImpl = fetch
}: RequestTaskAnalysisStatusInput): Promise<TaskWorkflowPayload> {
  const response = await fetchImpl(`/api/tasks/${taskId}/analysis`, {
    method: "GET"
  });
  const payload = (await response.json().catch(() => null)) as
    | TaskWorkflowPayload
    | { message?: string }
    | null;

  if (!response.ok) {
    throw new Error(payload?.message ?? "读取分析进度失败，请稍后再试");
  }

  return payload as TaskWorkflowPayload;
}

import type { TaskWorkflowPayload } from "@/src/lib/tasks/request-task-file-upload";

export type ConfirmPrimaryFilePayload = TaskWorkflowPayload & {
  primaryRequirementFileId: string;
};

type RequestConfirmPrimaryFileInput = {
  taskId: string;
  fileId: string;
  fetchImpl?: typeof fetch;
};

export async function requestConfirmPrimaryFile({
  taskId,
  fileId,
  fetchImpl = fetch
}: RequestConfirmPrimaryFileInput): Promise<ConfirmPrimaryFilePayload> {
  const response = await fetchImpl(`/api/tasks/${taskId}/files/confirm-primary`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      fileId
    })
  });
  const payload = (await response.json().catch(() => null)) as ConfirmPrimaryFilePayload | {
    message?: string;
  } | null;

  if (!response.ok) {
    throw new Error(payload?.message ?? "确认主任务文件失败，请稍后再试");
  }

  return payload as ConfirmPrimaryFilePayload;
}

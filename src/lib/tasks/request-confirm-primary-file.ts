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
    if (isConfirmPrimaryPayload(payload)) {
      return payload;
    }

    throw new Error(payload?.message ?? "确认主任务文件失败，请稍后再试");
  }

  return payload as ConfirmPrimaryFilePayload;
}

function isConfirmPrimaryPayload(value: unknown): value is ConfirmPrimaryFilePayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ConfirmPrimaryFilePayload>;
  return Boolean(
    candidate.task &&
      Array.isArray(candidate.files) &&
      typeof candidate.analysisStatus === "string" &&
      candidate.analysisProgress &&
      typeof candidate.primaryRequirementFileId === "string"
  );
}

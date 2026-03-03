type RequestTaskCancelInput = {
  taskId: string;
  fetchImpl?: typeof fetch;
};

type CancelResult = {
  ok: boolean;
  releasedQuota?: number;
  message: string;
};

export async function requestTaskCancel({
  taskId,
  fetchImpl = fetch
}: RequestTaskCancelInput): Promise<CancelResult> {
  const response = await fetchImpl(`/api/tasks/${taskId}/cancel`, {
    method: "POST"
  });

  const payload = (await response.json().catch(() => null)) as CancelResult | null;

  if (!response.ok) {
    throw new Error(payload?.message ?? "取消任务失败");
  }

  return payload as CancelResult;
}

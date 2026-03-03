export type HumanizeRequestPayload = {
  ok: boolean;
  taskId: string;
  frozenQuota: number;
  message: string;
};

type RequestHumanizeInput = {
  taskId: string;
  fetchImpl?: typeof fetch;
};

export async function requestHumanize({
  taskId,
  fetchImpl = fetch
}: RequestHumanizeInput): Promise<HumanizeRequestPayload> {
  const response = await fetchImpl(`/api/tasks/${taskId}/humanize`, {
    method: "POST",
    headers: { "content-type": "application/json" }
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      payload?.message ?? "降AI处理失败，请稍后再试。"
    );
  }

  return payload as HumanizeRequestPayload;
}

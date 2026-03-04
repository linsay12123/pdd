import type { TaskHumanizeStatus } from "@/src/types/tasks";

export type HumanizeRequestPayload = {
  ok: boolean;
  taskId: string;
  humanizeStatus: TaskHumanizeStatus;
  downloads: {
    humanizedDocxOutputId: string | null;
  };
  message: string;
};

export type HumanizeStatusPayload = {
  ok: boolean;
  taskId: string;
  humanizeStatus: TaskHumanizeStatus;
  provider: string;
  requestedAt?: string | null;
  completedAt?: string | null;
  errorMessage: string | null;
  downloads: {
    humanizedDocxOutputId: string | null;
  };
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

export async function requestHumanizeStatus({
  taskId,
  fetchImpl = fetch
}: RequestHumanizeInput): Promise<HumanizeStatusPayload> {
  const response = await fetchImpl(`/api/tasks/${taskId}/humanize`, {
    method: "GET"
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      payload?.message ?? "读取降AI进度失败，请稍后再试。"
    );
  }

  return payload as HumanizeStatusPayload;
}

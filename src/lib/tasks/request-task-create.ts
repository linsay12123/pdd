export type TaskCreatePayload = {
  task: {
    id: string;
    status: string;
    targetWordCount: number | null;
    citationStyle: string | null;
    specialRequirements: string;
  };
  frozenQuota: number;
  message: string;
};

type RequestTaskCreateInput = {
  specialRequirements: string;
  targetWordCount?: number;
  citationStyle?: string;
  fetchImpl?: typeof fetch;
};

export async function requestTaskCreate({
  specialRequirements,
  targetWordCount,
  citationStyle,
  fetchImpl = fetch
}: RequestTaskCreateInput): Promise<TaskCreatePayload> {
  const response = await fetchImpl("/api/tasks/create", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      specialRequirements,
      ...(typeof targetWordCount === "number" ? { targetWordCount } : {}),
      ...(citationStyle ? { citationStyle } : {})
    })
  });

  const payload = (await response.json().catch(() => null)) as TaskCreatePayload | {
    message?: string;
  } | null;

  if (!response.ok) {
    throw new Error(payload?.message ?? "创建任务失败，请稍后再试");
  }

  return payload as TaskCreatePayload;
}

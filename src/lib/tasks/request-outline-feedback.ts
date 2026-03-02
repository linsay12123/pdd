import type { OutlineScaffold } from "@/src/lib/ai/prompts/generate-outline";

export type OutlineFeedbackPayload = {
  task: {
    id: string;
    status: string;
    targetWordCount: number;
    citationStyle: string;
    specialRequirements: string;
  };
  outlineVersion: {
    id: string;
    versionNumber: number;
    isApproved?: boolean;
  };
  outline: OutlineScaffold;
  message: string;
};

type RequestOutlineFeedbackInput = {
  taskId: string;
  feedback: string;
  fetchImpl?: typeof fetch;
};

export async function requestOutlineFeedback({
  taskId,
  feedback,
  fetchImpl = fetch
}: RequestOutlineFeedbackInput): Promise<OutlineFeedbackPayload> {
  const response = await fetchImpl(`/api/tasks/${taskId}/outline/feedback`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      feedback
    })
  });
  const payload = (await response.json().catch(() => null)) as OutlineFeedbackPayload | {
    message?: string;
  } | null;

  if (!response.ok) {
    throw new Error(payload?.message ?? "重新生成大纲失败，请稍后再试");
  }

  return payload as OutlineFeedbackPayload;
}

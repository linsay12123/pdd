import type { TaskWorkflowHumanizePayload } from "@/src/lib/tasks/request-task-file-upload";

export type OutlineApprovalPayload = {
  task: {
    id: string;
    status: string;
    targetWordCount: number | null;
    citationStyle: string | null;
    specialRequirements: string;
    workflowErrorMessage?: string | null;
    lastWorkflowStage?: "drafting" | "adjusting_word_count" | "verifying_references" | "exporting" | null;
    workflowStageTimestamps?: {
      drafting?: string;
      adjusting_word_count?: string;
      verifying_references?: string;
      exporting?: string;
      deliverable_ready?: string;
      failed?: string;
    };
  };
  outlineVersion: {
    id: string;
    isApproved: boolean;
  };
  downloads: {
    finalDocxOutputId: string | null;
    referenceReportOutputId: string | null;
  };
  humanize?: TaskWorkflowHumanizePayload | null;
  finalWordCount: number | null;
  message: string;
};

type RequestOutlineApprovalInput = {
  taskId: string;
  outlineVersionId?: string;
  fetchImpl?: typeof fetch;
};

export async function requestOutlineApproval({
  taskId,
  outlineVersionId,
  fetchImpl = fetch
}: RequestOutlineApprovalInput): Promise<OutlineApprovalPayload> {
  const response = await fetchImpl(`/api/tasks/${taskId}/outline/approve`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      ...(outlineVersionId ? { outlineVersionId } : {})
    })
  });
  const payload = (await response.json().catch(() => null)) as OutlineApprovalPayload | {
    message?: string;
  } | null;

  if (!response.ok) {
    throw new Error(payload?.message ?? "确认大纲失败，请稍后再试");
  }

  return payload as OutlineApprovalPayload;
}

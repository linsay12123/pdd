import {
  requireFormalPersistence,
  shouldUseLocalTestPersistence,
  shouldUseSupabasePersistence
} from "@/src/lib/persistence/runtime-mode";
import { getLatestOwnedDraftFromSupabase } from "@/src/lib/tasks/supabase-task-records";
import { getOwnedTaskSummary } from "@/src/lib/tasks/save-task-files";
import { toSessionTaskPayload } from "@/src/lib/tasks/session-task";
import { listOwnedTaskOutputs } from "@/src/lib/tasks/task-output-store";
import type { SessionTaskPayload } from "@/src/lib/tasks/session-task";

type WorkflowSnapshot = {
  ok: true;
  task: SessionTaskPayload;
  downloads: {
    finalDocxOutputId: string | null;
    referenceReportOutputId: string | null;
    humanizedDocxOutputId: string | null;
  };
  finalWordCount: number | null;
  message: string;
};

export async function buildTaskWorkflowSnapshot(input: {
  taskId: string;
  userId: string;
}): Promise<WorkflowSnapshot> {
  const task = await getOwnedTaskSummary(input.taskId, input.userId);

  if (!task) {
    throw new Error("TASK_NOT_FOUND");
  }

  const downloads = await buildWorkflowDownloads(task, input.taskId, input.userId);
  const finalWordCount = await getWorkflowFinalWordCount(task, input.taskId, input.userId);

  return {
    ok: true,
    task: toSessionTaskPayload(task),
    downloads,
    finalWordCount,
    message: mapPostApprovalWorkflowMessage({
      taskStatus: task.status,
      lastWorkflowStage: task.lastWorkflowStage ?? null,
      workflowErrorMessage: task.workflowErrorMessage ?? null
    })
  };
}

export function mapPostApprovalWorkflowMessage(input: {
  taskStatus: string;
  lastWorkflowStage: "drafting" | "adjusting_word_count" | "verifying_references" | "exporting" | null;
  workflowErrorMessage?: string | null;
}) {
  if (input.taskStatus === "drafting") {
    return "系统正在根据你确认的大纲一次性写完整篇文章。";
  }

  if (input.taskStatus === "adjusting_word_count") {
    return "系统正在把正文部分校正到目标字数的正负 10 以内。";
  }

  if (input.taskStatus === "verifying_references") {
    return "系统正在逐条核对参考文献与来源链接。";
  }

  if (input.taskStatus === "exporting") {
    return "系统正在生成最终文档和引用核验报告。";
  }

  if (input.taskStatus === "deliverable_ready") {
    return "任务已完成，最终文档和引用核验报告已经准备好。";
  }

  if (input.taskStatus === "failed") {
    if (input.workflowErrorMessage?.trim()) {
      return input.workflowErrorMessage.trim();
    }

    if (input.lastWorkflowStage === "adjusting_word_count") {
      return "字数校正这一步失败了，你可以重新开始正文生成。";
    }

    if (input.lastWorkflowStage === "verifying_references") {
      return "引用核验这一步失败了，你可以重新开始正文生成。";
    }

    if (input.lastWorkflowStage === "exporting") {
      return "导出生成这一步失败了，你可以重新开始正文生成。";
    }

    return "正文写作这一步失败了，你可以重新开始正文生成。";
  }

  return "系统正在准备正文写作流程。";
}

export async function buildWorkflowDownloads(
  task: Awaited<ReturnType<typeof getOwnedTaskSummary>>,
  taskId: string,
  userId: string
) {
  const status = task?.status ?? null;

  if (
    status !== "exporting" &&
    status !== "deliverable_ready"
  ) {
    return {
      finalDocxOutputId: null,
      referenceReportOutputId: null,
      humanizedDocxOutputId: null
    };
  }

  const outputs = await listOwnedTaskOutputs({
    taskId,
    userId
  });

  const findLatestOutputId = (outputKind: string) =>
    [...outputs]
      .reverse()
      .find((output) => output.outputKind === outputKind && output.isActive)?.id ?? null;

  return {
    finalDocxOutputId: findLatestOutputId("final_docx"),
    referenceReportOutputId: findLatestOutputId("reference_report_pdf"),
    humanizedDocxOutputId: findLatestOutputId("humanized_docx")
  };
}

export async function getWorkflowFinalWordCount(
  task: Awaited<ReturnType<typeof getOwnedTaskSummary>>,
  taskId: string,
  userId: string
) {
  if (
    task?.status !== "verifying_references" &&
    task?.status !== "exporting" &&
    task?.status !== "deliverable_ready" &&
    !(task?.status === "failed" && task?.latestDraftVersionId)
  ) {
    return null;
  }

  if (!task?.latestDraftVersionId) {
    return null;
  }

  if (shouldUseSupabasePersistence()) {
    const draft = await getLatestOwnedDraftFromSupabase(taskId, userId);
    return draft?.bodyWordCount ?? null;
  }

  if (!shouldUseLocalTestPersistence()) {
    requireFormalPersistence();
  }

  const { getTaskDraftVersion } = await import("@/src/lib/tasks/repository");
  const draft = getTaskDraftVersion(taskId, task.latestDraftVersionId);
  return draft?.bodyWordCount ?? null;
}

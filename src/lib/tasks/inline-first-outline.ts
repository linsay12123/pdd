import type { OutlineScaffold } from "@/src/lib/ai/prompts/generate-outline";
import { buildAnalysisProgressPayload } from "@/src/lib/tasks/analysis-progress";
import type {
  TaskWorkflowAnalysisRuntimePayload,
  TaskWorkflowClassificationPayload,
  TaskWorkflowRuleCardPayload
} from "@/src/lib/tasks/request-task-file-upload";
import {
  getOwnedTaskSummary,
  listTaskFilesForWorkflow,
  markTaskAnalysisFailed,
  markTaskAnalysisPending
} from "@/src/lib/tasks/save-task-files";
import { runAnalyzeUploadedTaskPipeline } from "@/src/lib/tasks/analyze-uploaded-task-pipeline";
import {
  toSessionTaskHumanizePayload,
  toSessionTaskPayload
} from "@/src/lib/tasks/session-task";
import {
  requireFormalPersistence,
  shouldUseLocalTestPersistence,
  shouldUseSupabasePersistence
} from "@/src/lib/persistence/runtime-mode";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import type { TaskAnalysisSnapshot, TaskFileRecord, TaskSummary } from "@/src/types/tasks";

export type InlineFirstOutlineSource = "upload" | "confirm_primary" | "manual_retry";

export type InlineFirstOutlineResult = {
  task: ReturnType<typeof toSessionTaskPayload>;
  taskSummary: TaskSummary;
  files: TaskFileRecord[];
  classification: TaskWorkflowClassificationPayload;
  analysisStatus: "succeeded" | "failed";
  analysisProgress: ReturnType<typeof buildAnalysisProgressPayload>;
  analysisRuntime: TaskWorkflowAnalysisRuntimePayload;
  analysis: TaskAnalysisSnapshot | null;
  ruleCard: TaskWorkflowRuleCardPayload | null;
  outline: OutlineScaffold | null;
  humanize: ReturnType<typeof toSessionTaskHumanizePayload>;
};

type RunInlineFirstOutlineInput = {
  taskId: string;
  userId: string;
  source: InlineFirstOutlineSource;
  forcedPrimaryFileId?: string | null;
};

const INLINE_ANALYSIS_DID_NOT_FINISH = "INLINE_ANALYSIS_DID_NOT_FINISH";

export async function runInlineFirstOutline(
  input: RunInlineFirstOutlineInput
): Promise<InlineFirstOutlineResult> {
  const taskBeforeRun = await getOwnedTaskSummary(input.taskId, input.userId);
  if (!taskBeforeRun) {
    throw new Error("TASK_NOT_FOUND");
  }

  const nextRetryCount = computeNextAnalysisRetryCount(taskBeforeRun, input.source);

  await markTaskAnalysisPending({
    taskId: input.taskId,
    userId: input.userId,
    primaryRequirementFileId:
      input.forcedPrimaryFileId !== undefined ? input.forcedPrimaryFileId : undefined,
    triggerRunId: null,
    analysisModel: "gpt-5.2",
    analysisRetryCount: nextRetryCount
  });

  try {
    await runAnalyzeUploadedTaskPipeline({
      taskId: input.taskId,
      userId: input.userId,
      forcedPrimaryFileId: input.forcedPrimaryFileId ?? null
    });
  } catch {
    // The pipeline already writes the failed state. The route only needs the final snapshot.
  }

  let taskAfterRun = await getOwnedTaskSummary(input.taskId, input.userId);
  if (!taskAfterRun) {
    throw new Error("TASK_NOT_FOUND");
  }

  if (taskAfterRun.analysisStatus === "pending") {
    await markTaskAnalysisFailed({
      taskId: input.taskId,
      userId: input.userId,
      reason: INLINE_ANALYSIS_DID_NOT_FINISH,
      analysisRetryCount: taskAfterRun.analysisRetryCount ?? nextRetryCount
    });
    taskAfterRun = (await getOwnedTaskSummary(input.taskId, input.userId)) ?? taskAfterRun;
  }

  const files = await listTaskFilesForWorkflow(input.taskId, input.userId);
  const analysis = taskAfterRun.analysisSnapshot ?? null;
  const analysisStatus = taskAfterRun.analysisStatus === "succeeded" ? "succeeded" : "failed";
  const analysisProgress = buildAnalysisProgressPayload({
    status: analysisStatus,
    requestedAt: taskAfterRun.analysisRequestedAt ?? null,
    startedAt: taskAfterRun.analysisStartedAt ?? null,
    completedAt: taskAfterRun.analysisCompletedAt ?? null
  });
  const outline =
    analysisStatus === "succeeded" && taskAfterRun.latestOutlineVersionId
      ? await getOutlineByVersionId(input.taskId, input.userId, taskAfterRun.latestOutlineVersionId)
      : null;

  return {
    task: toSessionTaskPayload(taskAfterRun),
    taskSummary: taskAfterRun,
    files,
    classification: buildClassificationFromTask(
      taskAfterRun.primaryRequirementFileId ?? null,
      analysis
    ),
    analysisStatus,
    analysisProgress,
    analysisRuntime: {
      state: "not_applicable",
      status: null,
      detail: "首版大纲这一步已经在当前请求里直接完成，不再走后台排队。",
      autoRecovered: false,
      runId: null
    },
    analysis,
    ruleCard:
      analysisStatus === "succeeded" && analysis && !analysis.needsUserConfirmation
        ? buildRuleCardFromAnalysis(analysis, outline)
        : null,
    outline: analysisStatus === "succeeded" ? outline : null,
    humanize: toSessionTaskHumanizePayload(taskAfterRun)
  };
}

function computeNextAnalysisRetryCount(
  task: Pick<TaskSummary, "analysisRetryCount" | "analysisRequestedAt" | "analysisTriggerRunId">,
  source: InlineFirstOutlineSource
) {
  const current = Number(task.analysisRetryCount ?? 0);
  const hasExistingAnalysisTrace = Boolean(
    task.analysisRequestedAt?.trim() || task.analysisTriggerRunId?.trim()
  );

  if (source === "upload" && !hasExistingAnalysisTrace) {
    return current;
  }

  return current + 1;
}

function buildClassificationFromTask(
  primaryRequirementFileId: string | null,
  analysis: TaskAnalysisSnapshot | null
): TaskWorkflowClassificationPayload {
  return {
    primaryRequirementFileId: analysis?.chosenTaskFileId ?? primaryRequirementFileId,
    backgroundFileIds: analysis?.supportingFileIds ?? [],
    irrelevantFileIds: analysis?.ignoredFileIds ?? [],
    needsUserConfirmation: analysis?.needsUserConfirmation ?? false,
    reasoning: analysis?.reasoning ?? "系统已经完成这轮分析。"
  };
}

function buildRuleCardFromAnalysis(
  analysis: TaskAnalysisSnapshot,
  outline: OutlineScaffold | null
): TaskWorkflowRuleCardPayload {
  return {
    topic: analysis.topic ?? outline?.articleTitle ?? null,
    targetWordCount: analysis.targetWordCount,
    citationStyle: analysis.citationStyle,
    chapterCountOverride: analysis.chapterCount,
    mustAnswer: analysis.mustCover,
    gradingPriorities: analysis.gradingFocus,
    specialRequirements: analysis.appliedSpecialRequirements
  };
}

async function getOutlineByVersionId(
  taskId: string,
  userId: string,
  outlineVersionId: string
) {
  if (!shouldUseSupabasePersistence()) {
    if (!shouldUseLocalTestPersistence()) {
      requireFormalPersistence();
    }

    const { getTaskOutlineVersion } = await import("@/src/lib/tasks/repository");
    return getTaskOutlineVersion(taskId, outlineVersionId)?.outline ?? null;
  }

  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("outline_versions")
    .select("english_outline")
    .eq("task_id", taskId)
    .eq("user_id", userId)
    .eq("id", outlineVersionId)
    .maybeSingle();

  if (error) {
    throw new Error(`读取大纲失败：${error.message}`);
  }

  if (!data?.english_outline) {
    return null;
  }

  if (typeof data.english_outline === "string") {
    return JSON.parse(data.english_outline) as OutlineScaffold;
  }

  return data.english_outline as OutlineScaffold;
}

import type { OutlineScaffold } from "@/src/lib/ai/prompts/generate-outline";
import {
  analyzeUploadedTaskWithOpenAI,
  MODEL_RAW_RESPONSE_ONLY,
  PROVIDER_HTTP_ERROR,
  PROVIDER_TRANSPORT_ERROR
} from "@/src/lib/ai/services/analyze-uploaded-task";
import { buildAnalysisProgressPayload } from "@/src/lib/tasks/analysis-progress";
import {
  getTaskAnalysisDisplayState,
  resolveTaskAnalysisRenderMode
} from "@/src/lib/tasks/analysis-render-mode";
import type {
  TaskWorkflowAnalysisRuntimePayload,
  TaskWorkflowClassificationPayload,
  TaskWorkflowRuleCardPayload
} from "@/src/lib/tasks/request-task-file-upload";
import {
  getOwnedTaskSummary,
  listTaskFilesForModel,
  listTaskFilesForWorkflow,
  markTaskAnalysisFailed,
  persistTaskModelAnalysis,
  persistTaskPartialModelAnalysis
} from "@/src/lib/tasks/save-task-files";
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
import type {
  TaskAnalysisRenderMode,
  TaskAnalysisSnapshot,
  TaskProviderErrorKind,
  TaskFileRecord,
  TaskSummary
} from "@/src/types/tasks";

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
  analysisRenderMode: TaskAnalysisRenderMode | null;
  rawModelResponse: string | null;
  providerStatusCode: number | null;
  providerErrorBody: string | null;
  providerErrorKind: TaskProviderErrorKind | null;
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
const ANALYSIS_MODEL = "gpt-5.2";

export async function runInlineFirstOutline(
  input: RunInlineFirstOutlineInput
): Promise<InlineFirstOutlineResult> {
  const taskBeforeRun = await getOwnedTaskSummary(input.taskId, input.userId);
  if (!taskBeforeRun) {
    throw new Error("TASK_NOT_FOUND");
  }

  const nextRetryCount = computeNextAnalysisRetryCount(taskBeforeRun, input.source);
  const startedAt = new Date().toISOString();
  const filesForModel = await listTaskFilesForModel(input.taskId, input.userId);
  if (filesForModel.length === 0) {
    throw new Error("TASK_FILES_NOT_FOUND");
  }

  try {
    const analyzed = await analyzeUploadedTaskWithOpenAI({
      files: filesForModel,
      specialRequirements: taskBeforeRun.specialRequirements ?? "",
      forcedPrimaryFileId: input.forcedPrimaryFileId ?? null
    });

    const renderMode = resolveTaskAnalysisRenderMode(analyzed.analysis);
    if (renderMode && renderMode !== "structured") {
      await persistTaskPartialModelAnalysis({
        taskId: input.taskId,
        userId: input.userId,
        analysis: analyzed.analysis,
        analysisAttempt: {
          requestedAt: startedAt,
          startedAt,
          model: ANALYSIS_MODEL,
          retryCount: nextRetryCount
        }
      });

      await markTaskAnalysisFailed({
        taskId: input.taskId,
        userId: input.userId,
        reason: resolveFailureReason(renderMode),
        analysisRetryCount: nextRetryCount,
        analysisRequestedAt: startedAt,
        analysisStartedAt: startedAt,
        analysisModel: ANALYSIS_MODEL
      });
    } else {
      await persistTaskModelAnalysis({
        taskId: input.taskId,
        userId: input.userId,
        analysis: analyzed.analysis,
        outline: analyzed.outline,
        analysisAttempt: {
          requestedAt: startedAt,
          startedAt,
          model: ANALYSIS_MODEL,
          retryCount: nextRetryCount
        }
      });
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const partialAnalysis =
      error &&
      typeof error === "object" &&
      "partialAnalysis" in error &&
      error.partialAnalysis &&
      typeof error.partialAnalysis === "object"
        ? (error.partialAnalysis as TaskAnalysisSnapshot)
        : null;

    if (partialAnalysis) {
      await persistTaskPartialModelAnalysis({
        taskId: input.taskId,
        userId: input.userId,
        analysis: partialAnalysis,
        analysisAttempt: {
          requestedAt: startedAt,
          startedAt,
          model: ANALYSIS_MODEL,
          retryCount: nextRetryCount
        }
      }).catch(() => {});
    }

    await markTaskAnalysisFailed({
      taskId: input.taskId,
      userId: input.userId,
      reason,
      analysisRetryCount: nextRetryCount,
      analysisRequestedAt: startedAt,
      analysisStartedAt: startedAt,
      analysisModel: ANALYSIS_MODEL
    }).catch(() => {});
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
      analysisRetryCount: nextRetryCount,
      analysisRequestedAt: startedAt,
      analysisStartedAt: startedAt,
      analysisModel: ANALYSIS_MODEL
    });
    taskAfterRun = (await getOwnedTaskSummary(input.taskId, input.userId)) ?? taskAfterRun;
  }

  const files = await listTaskFilesForWorkflow(input.taskId, input.userId);
  const analysis = taskAfterRun.analysisSnapshot ?? null;
  const {
    analysisRenderMode,
    rawModelResponse,
    providerStatusCode,
    providerErrorBody,
    providerErrorKind
  } = getTaskAnalysisDisplayState({
    analysis
  });
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
    classification: buildClassificationFromTask(taskAfterRun.primaryRequirementFileId ?? null, analysis),
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
    analysisRenderMode,
    rawModelResponse,
    providerStatusCode,
    providerErrorBody,
    providerErrorKind,
    ruleCard:
      analysisStatus === "succeeded" &&
      analysis &&
      !analysis.needsUserConfirmation &&
      analysisRenderMode === "structured"
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

function resolveAnalysisRenderMode(
  analysis: TaskAnalysisSnapshot | null | undefined
): TaskAnalysisRenderMode | null {
  if (!analysis) {
    return null;
  }

  return resolveTaskAnalysisRenderMode(analysis);
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

function resolveFailureReason(renderMode: TaskAnalysisRenderMode) {
  if (renderMode === "raw_model") {
    return MODEL_RAW_RESPONSE_ONLY;
  }

  if (renderMode === "raw_provider_error") {
    return PROVIDER_HTTP_ERROR;
  }

  return PROVIDER_TRANSPORT_ERROR;
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

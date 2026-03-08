import { NextResponse } from "next/server";
import { requireCurrentSessionUser } from "@/src/lib/auth/current-user";
import type { TaskWorkflowClassificationPayload } from "@/src/lib/tasks/request-task-file-upload";
import { buildAnalysisProgressPayload } from "@/src/lib/tasks/analysis-progress";
import { getTaskAnalysisDisplayState } from "@/src/lib/tasks/analysis-render-mode";
import { resolveInlineAnalysisFailure } from "@/src/lib/tasks/inline-analysis-failure";
import {
  getOwnedTaskSummary,
  listTaskFilesForWorkflow,
  markTaskAnalysisFailed
} from "@/src/lib/tasks/save-task-files";
import { listOwnedTaskOutputs } from "@/src/lib/tasks/task-output-store";
import {
  requireFormalPersistence,
  shouldUseLocalTestPersistence,
  shouldUseSupabasePersistence
} from "@/src/lib/persistence/runtime-mode";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import {
  toSessionTaskHumanizePayload,
  toSessionTaskPayload
} from "@/src/lib/tasks/session-task";
import { getLatestOwnedDraftFromSupabase } from "@/src/lib/tasks/supabase-task-records";
import type { OutlineScaffold } from "@/src/lib/ai/prompts/generate-outline";
import type { TaskAnalysisSnapshot } from "@/src/types/tasks";
import type { SessionUser } from "@/src/types/auth";
import {
  STALE_TRIGGER_RUN_REASON,
  TRIGGER_STARTUP_STALLED_REASON
} from "@/src/lib/tasks/analysis-runtime-cleanup";
import {
  resolveTriggerRunState,
  type TriggerRunRuntimeState
} from "@/src/lib/trigger/run-state";

type RouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

type AnalysisRuntimePayload = {
  state: "not_applicable" | TriggerRunRuntimeState;
  status: string | null;
  detail: string;
  autoRecovered: boolean;
  runId: string | null;
};

type AnalysisRouteDependencies = {
  requireUser?: () => Promise<SessionUser>;
  isPersistenceReady?: () => boolean;
  markTaskAnalysisFailed?: typeof markTaskAnalysisFailed;
  getTriggerRunState?: (
    runId: string
  ) => Promise<{ state: TriggerRunRuntimeState; status: string | null }>;
};

const ANALYSIS_STARTUP_GRACE_SECONDS = 3 * 60;

export async function handleTaskAnalysisStatusRequest(
  _request: Request,
  params: {
    taskId: string;
  },
  dependencies: AnalysisRouteDependencies = {}
) {
  try {
    if (!(dependencies.isPersistenceReady ?? shouldUseSupabasePersistence)()) {
      return NextResponse.json(
        {
          ok: false,
          message: "系统现在还没连上正式任务数据库，暂时无法读取分析进度。"
        },
        { status: 503 }
      );
    }

    const user = await (dependencies.requireUser ?? requireCurrentSessionUser)();
    let task = await getOwnedTaskSummary(params.taskId, user.id);

    if (!task) {
      return NextResponse.json(
        {
          ok: false,
          message: "没有找到这个任务，暂时不能读取分析进度。"
        },
        { status: 404 }
      );
    }

    const files = await listTaskFilesForWorkflow(params.taskId, user.id);
    let analysis = task.analysisSnapshot ?? null;
    let analysisStatus = task.analysisStatus ?? "pending";
    let analysisProgress = buildAnalysisProgressPayload({
      status: analysisStatus,
      requestedAt: task.analysisRequestedAt ?? null,
      startedAt: task.analysisStartedAt ?? null,
      completedAt: task.analysisCompletedAt ?? null
    });
    let analysisRuntime = buildDefaultAnalysisRuntime(task, analysisStatus);

    if (analysisStatus === "pending") {
      analysisRuntime = await resolveAnalysisRuntime(task, dependencies);

      if (shouldFailStalledStartup(task, analysisRuntime.state)) {
        await (dependencies.markTaskAnalysisFailed ?? markTaskAnalysisFailed)({
          taskId: params.taskId,
          userId: user.id,
          reason: TRIGGER_STARTUP_STALLED_REASON
        });

        task = (await getOwnedTaskSummary(params.taskId, user.id)) ?? task;
        analysis = task.analysisSnapshot ?? null;
        analysisStatus = task.analysisStatus ?? "failed";
        analysisProgress = buildAnalysisProgressPayload({
          status: analysisStatus,
          requestedAt: task.analysisRequestedAt ?? null,
          startedAt: task.analysisStartedAt ?? null,
          completedAt: task.analysisCompletedAt ?? null
        });
        analysisRuntime = buildDefaultAnalysisRuntime(task, analysisStatus);
      } else if (analysisProgress.canRetry) {
        analysisProgress = {
          ...analysisProgress,
          canRetry: true
        };
      }
    }

    const outline = task.latestOutlineVersionId
      ? await getOutlineByVersionId(params.taskId, user.id, task.latestOutlineVersionId)
      : null;

    const ruleCard =
      analysisStatus === "succeeded" && analysis && !analysis.needsUserConfirmation
        ? buildRuleCardFromAnalysis(analysis, outline)
        : null;
    const analysisDisplay = getTaskAnalysisDisplayState({
      analysis
    });

    const classification = buildClassificationFromTask(task.primaryRequirementFileId ?? null, analysis);
    const downloads = await buildWorkflowDownloads(task, params.taskId, user.id);
    const finalWordCount = await getWorkflowFinalWordCount(task, params.taskId, user.id);

    const message = mapWorkflowMessage({
      taskStatus: task.status,
      lastWorkflowStage: task.lastWorkflowStage ?? null,
      analysisStatus,
      analysisProgress,
      analysisRuntime,
      analysis,
      analysisErrorMessage: task.analysisErrorMessage ?? null
    });

    return NextResponse.json(
      {
        ok: true,
        task: toSessionTaskPayload(task),
        files,
        classification,
        analysisStatus,
        analysisProgress,
        analysisRuntime,
        analysis,
        analysisRenderMode: analysisDisplay.analysisRenderMode,
        rawModelResponse: analysisDisplay.rawModelResponse,
        providerStatusCode: analysisDisplay.providerStatusCode,
        providerErrorBody: analysisDisplay.providerErrorBody,
        providerErrorKind: analysisDisplay.providerErrorKind,
        ruleCard,
        outline: analysisStatus === "succeeded" ? outline : null,
        downloads,
        finalWordCount,
        humanize: toSessionTaskHumanizePayload(task),
        message
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json(
        {
          ok: false,
          message: "请先登录后再查看分析进度。"
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "读取分析进度失败"
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request, context: RouteContext) {
  const { taskId } = await context.params;
  return handleTaskAnalysisStatusRequest(request, { taskId });
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
    reasoning: analysis?.reasoning ?? "系统正在分析全部文件。"
  };
}

function buildRuleCardFromAnalysis(
  analysis: TaskAnalysisSnapshot,
  outline: OutlineScaffold | null
) {
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

function mapAnalysisFailureMessage(input: {
  analysis: TaskAnalysisSnapshot | null;
  analysisErrorMessage?: string | null;
}) {
  const warning = input.analysis?.warnings?.find((item) =>
    item.startsWith("analysis_failed:")
  );
  const code =
    input.analysisErrorMessage?.trim() ||
    warning?.replace("analysis_failed:", "")?.trim() ||
    "";

  if (!code) {
    return "这次分析失败了，请直接点“一键重试分析”，不用重新上传文件。";
  }

  if (code === STALE_TRIGGER_RUN_REASON) {
    return "这条旧的后台任务编号已经坏了。请直接点“一键重试分析”，系统会换一条新的后台任务编号，不用重新上传文件。";
  }

  if (code === TRIGGER_STARTUP_STALLED_REASON) {
    return "这次后台分析没有真正启动成功。你可以直接点“一键重试分析”，不用重新上传文件。";
  }

  if (code) {
    return resolveInlineAnalysisFailure(
      input.analysisErrorMessage,
      input.analysis
    ).message;
  }

  return "系统分析失败，请直接点“一键重试分析”，不用重新上传文件。如果连续失败，请联系人工支持。";
}

function mapWorkflowMessage(input: {
  taskStatus: string;
  lastWorkflowStage: "drafting" | "adjusting_word_count" | "verifying_references" | "exporting" | null;
  analysisStatus: "pending" | "succeeded" | "failed";
  analysisProgress: {
    canRetry: boolean;
  };
  analysisRuntime: AnalysisRuntimePayload;
  analysis: TaskAnalysisSnapshot | null;
  analysisErrorMessage?: string | null;
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

  if (input.taskStatus === "failed" && input.analysisStatus === "succeeded") {
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

  if (input.analysisStatus === "failed") {
    return mapAnalysisFailureMessage({
      analysis: input.analysis,
      analysisErrorMessage: input.analysisErrorMessage
    });
  }

  if (input.analysisStatus === "succeeded") {
    return input.analysis?.needsUserConfirmation
      ? "模型已阅读全部材料，但它认为主任务文件还需要你确认。"
      : "文件分析已完成，第一版大纲已就绪。";
  }

  if (input.analysisProgress.canRetry) {
    return "系统已经开始分析你上传的文件，但这次等待超时了。你可以点“一键重试分析”，不用重新上传文件。";
  }

  return "系统正在后台分析你上传的文件，请稍等。";
}

async function buildWorkflowDownloads(
  task: Awaited<ReturnType<typeof getOwnedTaskSummary>>,
  taskId: string,
  userId: string
) {
  const status = task?.status ?? null;

  if (
    status !== "exporting" &&
    status !== "deliverable_ready" &&
    status !== "humanizing" &&
    status !== "humanized_ready"
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

async function getWorkflowFinalWordCount(
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

function buildDefaultAnalysisRuntime(
  task: {
    analysisTriggerRunId?: string | null;
  },
  analysisStatus: "pending" | "succeeded" | "failed"
): AnalysisRuntimePayload {
  if (analysisStatus !== "pending") {
    return {
      state: "not_applicable",
      status: null,
      detail: "当前不是分析中状态，无需查询后台运行态。",
      autoRecovered: false,
      runId: task.analysisTriggerRunId?.trim() || null
    };
  }

  return {
    state: "unknown",
    status: null,
    detail: "系统正在确认后台分析任务状态。",
    autoRecovered: false,
    runId: task.analysisTriggerRunId?.trim() || null
  };
}

async function resolveAnalysisRuntime(
  task: {
    analysisTriggerRunId?: string | null;
  },
  dependencies: AnalysisRouteDependencies
): Promise<AnalysisRuntimePayload> {
  const runId = task.analysisTriggerRunId?.trim() || null;
  if (!runId) {
    return {
      state: "missing",
      status: null,
      detail: "当前任务没有记录后台运行编号，系统无法确认这一轮是否真正启动。",
      autoRecovered: false,
      runId: null
    };
  }

  const runtime = await (dependencies.getTriggerRunState ?? getTriggerRunState)(runId);
  return {
    state: runtime.state,
    status: runtime.status,
    detail: mapRunStateDetail(runtime.state),
    autoRecovered: false,
    runId
  };
}

function mapRunStateDetail(state: TriggerRunRuntimeState) {
  switch (state) {
    case "active":
      return "后台任务正在执行中。";
    case "pending_version":
      return "后台任务正在启动中，系统正在等这一轮正式接上。";
    case "terminal":
      return "上一轮后台任务已经结束，但任务状态还停在分析中。";
    case "missing":
      return "找不到对应的后台任务运行记录。";
    default:
      return "系统暂时无法确认后台任务状态。";
  }
}

function shouldFailStalledStartup(
  task: {
    analysisRequestedAt?: string | null;
    analysisStartedAt?: string | null;
    analysisTriggerRunId?: string | null;
  },
  runtimeState: AnalysisRuntimePayload["state"]
) {
  if (task.analysisStartedAt || !task.analysisTriggerRunId?.trim()) {
    return false;
  }

  const requestedAt = task.analysisRequestedAt?.trim();
  if (!requestedAt) {
    return false;
  }

  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(requestedAt).getTime()) / 1000)
  );
  if (elapsedSeconds < ANALYSIS_STARTUP_GRACE_SECONDS) {
    return false;
  }

  return (
    runtimeState === "pending_version" ||
    runtimeState === "missing" ||
    runtimeState === "terminal" ||
    runtimeState === "unknown"
  );
}

async function getTriggerRunState(
  runId: string
): Promise<{ state: TriggerRunRuntimeState; status: string | null }> {
  return resolveTriggerRunState(runId);
}

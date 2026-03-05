import { NextResponse } from "next/server";
import { tasks } from "@trigger.dev/sdk/v3";
import { requireCurrentSessionUser } from "@/src/lib/auth/current-user";
import type { TaskWorkflowClassificationPayload } from "@/src/lib/tasks/request-task-file-upload";
import { buildAnalysisProgressPayload } from "@/src/lib/tasks/analysis-progress";
import {
  getOwnedTaskSummary,
  listTaskFilesForWorkflow,
  markTaskAnalysisPending
} from "@/src/lib/tasks/save-task-files";
import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import {
  toSessionTaskHumanizePayload,
  toSessionTaskPayload
} from "@/src/lib/tasks/session-task";
import type { OutlineScaffold } from "@/src/lib/ai/prompts/generate-outline";
import type { TaskAnalysisSnapshot } from "@/src/types/tasks";
import type { SessionUser } from "@/src/types/auth";
import { getInvalidTriggerKeyReason } from "@/src/lib/trigger/key-guard";
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
  getTriggerRunState?: (
    runId: string
  ) => Promise<{ state: TriggerRunRuntimeState; status: string | null }>;
  enqueueTaskAnalysis?: (input: {
    taskId: string;
    userId: string;
    forcedPrimaryFileId?: string | null;
    idempotencyKey: string;
  }) => Promise<string | null>;
  markAnalysisPending?: typeof markTaskAnalysisPending;
};

const ANALYSIS_AUTO_RECOVER_AFTER_SECONDS = 2 * 60;
const ANALYSIS_AUTO_RECOVER_MAX_SECONDS = 10 * 60;

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

      const shouldAutoRecover = canAutoRecoverPendingAnalysis({
        task,
        progressElapsedSeconds: analysisProgress.elapsedSeconds,
        runtimeState: analysisRuntime.state
      });

      if (shouldAutoRecover) {
        const autoRecoverResult = await tryAutoRecoverPendingAnalysis({
          task,
          userId: user.id,
          dependencies
        });

        if (autoRecoverResult.triggered) {
          analysisRuntime = {
            state: autoRecoverResult.runtime.state,
            status: autoRecoverResult.runtime.status,
            detail: "检测到上一轮后台分析没有真正启动，系统已自动补提一次分析任务。",
            autoRecovered: true,
            runId: autoRecoverResult.triggerRunId
          };

          const refreshedTask = await getOwnedTaskSummary(params.taskId, user.id);
          if (refreshedTask) {
            task = refreshedTask;
            analysis = refreshedTask.analysisSnapshot ?? null;
            analysisStatus = refreshedTask.analysisStatus ?? "pending";
            analysisProgress = buildAnalysisProgressPayload({
              status: analysisStatus,
              requestedAt: refreshedTask.analysisRequestedAt ?? null,
              startedAt: refreshedTask.analysisStartedAt ?? null,
              completedAt: refreshedTask.analysisCompletedAt ?? null
            });
          }
        }
      }
    }

    const outline = task.latestOutlineVersionId
      ? await getOutlineByVersionId(params.taskId, user.id, task.latestOutlineVersionId)
      : null;

    const ruleCard =
      analysisStatus === "succeeded" && analysis && !analysis.needsUserConfirmation
        ? buildRuleCardFromAnalysis(analysis, outline)
        : null;

    const classification = buildClassificationFromTask(task.primaryRequirementFileId ?? null, analysis);

    const message = mapAnalysisMessage({
      analysisStatus,
      analysisProgress,
      analysisRuntime,
      analysis
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
        ruleCard,
        outline: analysisStatus === "succeeded" ? outline : null,
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

function mapAnalysisFailureMessage(analysis: TaskAnalysisSnapshot | null) {
  const warning = analysis?.warnings?.find((item) => item.startsWith("analysis_failed:"));
  const code = warning?.replace("analysis_failed:", "")?.trim() ?? "";

  if (!code) {
    return "这次分析失败了，请直接点“一键重试分析”，不用重新上传文件。";
  }

  if (code === "MODEL_ANALYSIS_TIMEOUT") {
    return "系统已经开始分析你上传的文件，但本次处理超过等待上限。请直接点“一键重试分析”，不用重新上传。";
  }

  if (
    code === "MODEL_ANALYSIS_INCOMPLETE" ||
    code === "MODEL_ANALYSIS_INCOMPLETE_AFTER_RETRY" ||
    code === "MODEL_RETURNED_EMPTY_OUTLINE" ||
    code === "MODEL_RETURNED_EMPTY_OUTLINE_AFTER_RETRY"
  ) {
    return "系统已经读到你上传的文件，但模型这次返回内容不完整。请直接点“一键重试分析”，不用重新上传。";
  }

  if (code.startsWith("OpenAI request failed with status")) {
    return "模型服务暂时不稳定，请稍后再试。";
  }

  return "系统分析失败，请直接点“一键重试分析”，不用重新上传文件。如果连续失败，请联系人工支持。";
}

function mapAnalysisMessage(input: {
  analysisStatus: "pending" | "succeeded" | "failed";
  analysisProgress: {
    canRetry: boolean;
  };
  analysisRuntime: AnalysisRuntimePayload;
  analysis: TaskAnalysisSnapshot | null;
}) {
  if (input.analysisStatus === "failed") {
    return mapAnalysisFailureMessage(input.analysis);
  }

  if (input.analysisStatus === "succeeded") {
    return input.analysis?.needsUserConfirmation
      ? "模型已阅读全部材料，但它认为主任务文件还需要你确认。"
      : "文件分析已完成，第一版大纲已就绪。";
  }

  if (input.analysisRuntime.autoRecovered) {
    return "检测到上一轮后台分析没有真正启动，系统已自动补提一次分析任务。请再等一会儿。";
  }

  if (input.analysisRuntime.state === "pending_version") {
    return "后台任务版本还没部署到生产环境，当前这轮不会真正执行。请先部署 Trigger 任务版本。";
  }

  if (input.analysisProgress.canRetry) {
    return "系统已经开始分析你上传的文件，但这次等待超时了。你可以点“一键重试分析”，不用重新上传文件。";
  }

  return "系统正在后台分析你上传的文件，请稍等。";
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
      return "后台任务版本还没部署到生产环境。";
    case "terminal":
      return "上一轮后台任务已经结束，但任务状态还停在分析中。";
    case "missing":
      return "找不到对应的后台任务运行记录。";
    default:
      return "系统暂时无法确认后台任务状态。";
  }
}

function canAutoRecoverPendingAnalysis(input: {
  task: {
    analysisStartedAt?: string | null;
    analysisModel?: string | null;
  };
  progressElapsedSeconds: number;
  runtimeState: AnalysisRuntimePayload["state"];
}) {
  const hasStarted = Boolean(input.task.analysisStartedAt);
  const alreadyAutoRecovered = input.task.analysisModel === "analysis_auto_recovered_once";
  const withinAutoRecoverWindow =
    input.progressElapsedSeconds >= ANALYSIS_AUTO_RECOVER_AFTER_SECONDS &&
    input.progressElapsedSeconds <= ANALYSIS_AUTO_RECOVER_MAX_SECONDS;
  const canRecoverByState =
    input.runtimeState === "terminal" || input.runtimeState === "missing";

  return (
    !hasStarted &&
    !alreadyAutoRecovered &&
    withinAutoRecoverWindow &&
    canRecoverByState
  );
}

async function tryAutoRecoverPendingAnalysis(input: {
  task: {
    id: string;
    analysisRequestedAt?: string | null;
    analysisTriggerRunId?: string | null;
    primaryRequirementFileId?: string | null;
  };
  userId: string;
  dependencies: AnalysisRouteDependencies;
}): Promise<{
  triggered: boolean;
  triggerRunId: string | null;
  runtime: { state: TriggerRunRuntimeState; status: string | null };
}> {
  if (!process.env.TRIGGER_SECRET_KEY?.trim()) {
    return {
      triggered: false,
      triggerRunId: null,
      runtime: { state: "unknown", status: null }
    };
  }

  const invalidTriggerKeyReason = getInvalidTriggerKeyReason({
    triggerSecretKey: process.env.TRIGGER_SECRET_KEY,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV
  });
  if (invalidTriggerKeyReason === "dev_key_in_production") {
    return {
      triggered: false,
      triggerRunId: null,
      runtime: { state: "pending_version", status: "INVALID_KEY" }
    };
  }

  const triggerRunId = await (input.dependencies.enqueueTaskAnalysis ??
    enqueueAnalyzeTaskWithTrigger)({
    taskId: input.task.id,
    userId: input.userId,
    forcedPrimaryFileId: input.task.primaryRequirementFileId ?? null,
    idempotencyKey: buildAutoRecoverIdempotencyKey(input.task.id, input.userId, {
      requestedAt: input.task.analysisRequestedAt ?? null,
      triggerRunId: input.task.analysisTriggerRunId ?? null
    })
  }).catch(() => null);

  if (!triggerRunId) {
    return {
      triggered: false,
      triggerRunId: null,
      runtime: { state: "unknown", status: null }
    };
  }

  await (input.dependencies.markAnalysisPending ?? markTaskAnalysisPending)({
    taskId: input.task.id,
    userId: input.userId,
    primaryRequirementFileId: input.task.primaryRequirementFileId ?? null,
    triggerRunId,
    analysisModel: "analysis_auto_recovered_once"
  }).catch(() => null);

  return {
    triggered: true,
    triggerRunId,
    runtime: { state: "active", status: "QUEUED" }
  };
}

function buildAutoRecoverIdempotencyKey(
  taskId: string,
  userId: string,
  seed: { requestedAt: string | null; triggerRunId: string | null }
) {
  const stableSeed = (seed.triggerRunId ?? seed.requestedAt ?? "no-analysis-run")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .slice(0, 64);
  return `task-analysis-auto-recover-${taskId}-${userId}-${stableSeed}`;
}

async function enqueueAnalyzeTaskWithTrigger(input: {
  taskId: string;
  userId: string;
  forcedPrimaryFileId?: string | null;
  idempotencyKey: string;
}) {
  const run = await tasks.trigger(
    "analyze-uploaded-task",
    {
      taskId: input.taskId,
      userId: input.userId,
      forcedPrimaryFileId: input.forcedPrimaryFileId ?? null
    },
    {
      queue: "task-analysis",
      concurrencyKey: `task-analysis-${input.taskId}`,
      idempotencyKey: input.idempotencyKey
    }
  );

  return typeof run?.id === "string" ? run.id : null;
}

async function getTriggerRunState(
  runId: string
): Promise<{ state: TriggerRunRuntimeState; status: string | null }> {
  return resolveTriggerRunState(runId);
}

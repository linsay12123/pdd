import { NextResponse } from "next/server";
import { tasks } from "@trigger.dev/sdk/v3";
import { requireCurrentSessionUser } from "@/src/lib/auth/current-user";
import {
  buildAnalysisProgressPayload,
  type AnalysisStatus
} from "@/src/lib/tasks/analysis-progress";
import { startTaskAnalysisRun } from "@/src/lib/tasks/start-task-analysis-run";
import {
  getOwnedTaskSummary,
  listTaskFilesForWorkflow,
  markTaskAnalysisFailed,
  markTaskAnalysisPending
} from "@/src/lib/tasks/save-task-files";
import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import {
  toSessionTaskHumanizePayload,
  toSessionTaskPayload
} from "@/src/lib/tasks/session-task";
import { getInvalidTriggerKeyReason } from "@/src/lib/trigger/key-guard";
import {
  resolveTriggerRunState,
  type TriggerRunRuntimeState
} from "@/src/lib/trigger/run-state";
import { TRIGGER_DEPLOYMENT_UNAVAILABLE_REASON } from "@/src/lib/tasks/analysis-runtime-cleanup";
import type { SessionUser } from "@/src/types/auth";

type RouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

type EnqueueAnalyzeTaskInput = {
  taskId: string;
  userId: string;
  forcedPrimaryFileId?: string | null;
  idempotencyKey: string;
};

type TaskAnalysisRetryRouteDependencies = {
  requireUser?: () => Promise<SessionUser>;
  isPersistenceReady?: () => boolean;
  getTriggerRunState?: (
    runId: string
  ) => Promise<{ state: TriggerRunRuntimeState; status: string | null }>;
  enqueueTaskAnalysis?: (input: EnqueueAnalyzeTaskInput) => Promise<string | null>;
  startupProbeAttempts?: number;
  startupProbeDelayMs?: number;
  sleepImpl?: (ms: number) => Promise<void>;
};

export async function handleTaskAnalysisRetryRequest(
  _request: Request,
  params: {
    taskId: string;
  },
  dependencies: TaskAnalysisRetryRouteDependencies = {}
) {
  try {
    if (!(dependencies.isPersistenceReady ?? shouldUseSupabasePersistence)()) {
      return NextResponse.json(
        {
          ok: false,
          message: "系统现在还没连上正式任务数据库，暂时不能重试分析。"
        },
        { status: 503 }
      );
    }

    if (!process.env.TRIGGER_SECRET_KEY?.trim()) {
      return NextResponse.json(
        {
          ok: false,
          message: "后台任务密钥还没配置好，暂时不能重试分析。"
        },
        { status: 503 }
      );
    }

    const invalidTriggerKeyReason = getInvalidTriggerKeyReason({
      triggerSecretKey: process.env.TRIGGER_SECRET_KEY,
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV
    });
    if (invalidTriggerKeyReason === "dev_key_in_production") {
      return NextResponse.json(
        {
          ok: false,
          message:
            "当前是生产环境，但后台任务密钥还是开发版（tr_dev_）。请先换成生产密钥（通常是 tr_prod_）再重试。"
        },
        { status: 503 }
      );
    }

    const user = await (dependencies.requireUser ?? requireCurrentSessionUser)();
    const task = await getOwnedTaskSummary(params.taskId, user.id);

    if (!task) {
      return NextResponse.json(
        {
          ok: false,
          message: "没有找到这个任务，暂时不能重试分析。"
        },
        { status: 404 }
      );
    }

    const files = await listTaskFilesForWorkflow(params.taskId, user.id);
    if (files.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "这个任务还没有可用文件，暂时不能重试分析。"
        },
        { status: 409 }
      );
    }

    const currentStatus = (task.analysisStatus ?? "pending") as AnalysisStatus;
    const currentProgress = buildAnalysisProgressPayload({
      status: currentStatus,
      requestedAt: task.analysisRequestedAt ?? null,
      startedAt: task.analysisStartedAt ?? null,
      completedAt: task.analysisCompletedAt ?? null
    });
    const currentRunId = task.analysisTriggerRunId?.trim();
    const currentRuntime = currentRunId
      ? await (dependencies.getTriggerRunState ?? getTriggerRunState)(currentRunId)
      : null;
    const canRetry =
      currentStatus === "failed" ||
      currentProgress.canRetry;

    if (!canRetry) {
      return NextResponse.json(
        {
          ok: false,
          message: "系统还在处理中，暂时不用重试。请稍后再看一次进度。"
        },
        { status: 409 }
      );
    }

    if (currentRuntime) {
      if (currentRuntime.state === "active") {
        const activeProgress = buildAnalysisProgressPayload({
          status: "pending",
          requestedAt: task.analysisRequestedAt ?? null,
          startedAt: task.analysisStartedAt ?? null,
          completedAt: task.analysisCompletedAt ?? null
        });

        return NextResponse.json(
          {
            ok: true,
            task: toSessionTaskPayload(task),
            files,
            classification: {
              primaryRequirementFileId: task.primaryRequirementFileId ?? null,
              backgroundFileIds: [],
              irrelevantFileIds: [],
              needsUserConfirmation: false,
              reasoning: "后台正在执行上一轮分析。"
            },
            analysisStatus: "pending",
            analysisProgress: {
              ...activeProgress,
              canRetry: false
            },
            analysisRuntime: {
              state: currentRuntime.state,
              status: currentRuntime.status,
              detail: "上一轮后台分析任务还在运行中。",
              autoRecovered: false,
              runId: currentRunId
            },
            analysis: task.analysisSnapshot ?? null,
            ruleCard: null,
            outline: null,
            humanize: toSessionTaskHumanizePayload(task),
            message: "上一轮分析还在后台运行，系统已避免重复排队。请稍后再看进度。"
          },
          { status: 202 }
        );
      }
    }

    const dispatchResult = await startTaskAnalysisRun({
      task,
      userId: user.id,
      source: "manual_retry",
      forcedPrimaryFileId: task.primaryRequirementFileId ?? null,
      enqueueTaskAnalysis: dependencies.enqueueTaskAnalysis ?? enqueueAnalyzeTaskWithTrigger,
      getTriggerRunState: dependencies.getTriggerRunState ?? getTriggerRunState,
      markTaskAnalysisPending,
      markTaskAnalysisFailed,
      startupProbeAttempts: dependencies.startupProbeAttempts,
      startupProbeDelayMs: dependencies.startupProbeDelayMs,
      sleepImpl: dependencies.sleepImpl
    });

    if (!dispatchResult.ok) {
      return NextResponse.json(
        {
          ok: false,
          message:
            dispatchResult.reason === TRIGGER_DEPLOYMENT_UNAVAILABLE_REASON
              ? "后台分析版本当前还没准备好，所以这次重新分析也没法真正开工。请先把后台发布完成，再重试。"
              : "系统刚刚已经重新换了一条新的后台任务，但新的任务还是没真正启动起来。说明当前线上后台环境确实有问题。"
        },
        { status: 503 }
      );
    }

    const refreshedTask = await getOwnedTaskSummary(params.taskId, user.id);
    const refreshedFiles = await listTaskFilesForWorkflow(params.taskId, user.id);
    const analysisProgress = buildAnalysisProgressPayload({
      status: "pending",
      requestedAt: refreshedTask?.analysisRequestedAt ?? null,
      startedAt: refreshedTask?.analysisStartedAt ?? null,
      completedAt: refreshedTask?.analysisCompletedAt ?? null
    });

    return NextResponse.json(
      {
        ok: true,
        task: toSessionTaskPayload(refreshedTask ?? task),
        files: refreshedFiles,
        classification: {
          primaryRequirementFileId: refreshedTask?.primaryRequirementFileId ?? null,
          backgroundFileIds: [],
          irrelevantFileIds: [],
          needsUserConfirmation: false,
          reasoning: "系统已重新排队分析。"
        },
        analysisStatus: "pending",
        analysisProgress,
        analysisRuntime: {
          state: dispatchResult.runtime.state,
          status: dispatchResult.runtime.status,
          detail:
            dispatchResult.runtime.state === "unknown"
              ? "后台重试任务已受理，系统正在确认这一轮是否已经真正开始执行。"
              : dispatchResult.autoRecovered
                ? "第一张后台任务编号没有真正启动，系统刚刚已经自动换了一张新的后台编号。"
                : "后台重试任务已受理，正在排队或准备执行。",
          autoRecovered: dispatchResult.autoRecovered,
          runId: dispatchResult.triggerRunId
        },
        analysis: refreshedTask?.analysisSnapshot ?? null,
        ruleCard: null,
        outline: null,
        humanize: toSessionTaskHumanizePayload(refreshedTask ?? task),
        message: dispatchResult.autoRecovered
          ? "系统已经重新发起分析，并且自动跳过了一张没真正启动起来的后台任务编号。"
          : "已重新提交后台分析，系统正在重新生成第一版大纲。"
      },
      { status: 202 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json(
        {
          ok: false,
          message: "请先登录后再重试分析。"
        },
        { status: 401 }
      );
    }

    if (
      error instanceof Error &&
      (
        error.message.includes("trigger") ||
        error.message.includes("queue") ||
        error.message === "TRIGGER_RUN_ID_MISSING"
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "后台重试任务启动失败，请稍后再试。"
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "重试分析失败"
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { taskId } = await context.params;
  return handleTaskAnalysisRetryRequest(request, { taskId });
}

async function enqueueAnalyzeTaskWithTrigger(input: EnqueueAnalyzeTaskInput) {
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

import { NextResponse } from "next/server";
import { tasks } from "@trigger.dev/sdk/v3";
import { requireCurrentSessionUser } from "@/src/lib/auth/current-user";
import {
  buildAnalysisProgressPayload,
  type AnalysisStatus
} from "@/src/lib/tasks/analysis-progress";
import {
  getOwnedTaskSummary,
  listTaskFilesForWorkflow,
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
};

type TriggerRuntimeSnapshot = {
  state: TriggerRunRuntimeState;
  status: string | null;
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
      currentProgress.canRetry ||
      currentRuntime?.state === "pending_version";

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

    const triggerRunId = await (dependencies.enqueueTaskAnalysis ?? enqueueAnalyzeTaskWithTrigger)({
      taskId: params.taskId,
      userId: user.id,
      forcedPrimaryFileId: task.primaryRequirementFileId ?? null,
      idempotencyKey: buildRetryIdempotencyKey(task.id, user.id, {
        requestedAt: task.analysisRequestedAt ?? null,
        triggerRunId: task.analysisTriggerRunId ?? null
      })
    });
    if (!triggerRunId) {
      throw new Error("TRIGGER_RUN_ID_MISSING");
    }

    const freshRuntime = await (dependencies.getTriggerRunState ?? getTriggerRunState)(
      triggerRunId
    ).catch(
      (): TriggerRuntimeSnapshot => ({
        state: "unknown",
        status: null
      })
    );

    await markTaskAnalysisPending({
      taskId: params.taskId,
      userId: user.id,
      primaryRequirementFileId: task.primaryRequirementFileId ?? null,
      triggerRunId
    });

    if (freshRuntime.state === "pending_version") {
      return NextResponse.json(
        {
          ok: false,
          message:
            "系统刚刚已经重新换了一条后台任务，但新的任务还是显示“版本没部署”。说明现在生产环境还没准备好。"
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
          state: normalizeFreshEnqueuedRuntime(freshRuntime).state,
          status: normalizeFreshEnqueuedRuntime(freshRuntime).status,
          detail: "后台重试任务已受理，正在排队或准备执行。",
          autoRecovered: false,
          runId: triggerRunId
        },
        analysis: refreshedTask?.analysisSnapshot ?? null,
        ruleCard: null,
        outline: null,
        humanize: toSessionTaskHumanizePayload(refreshedTask ?? task),
        message: "已重新提交后台分析，系统正在重新生成第一版大纲。"
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

function normalizeFreshEnqueuedRuntime(
  runtime: TriggerRuntimeSnapshot
): TriggerRuntimeSnapshot {
  if (runtime.state === "pending_version") {
    return runtime;
  }

  return {
    state: "active",
    status: runtime.status ?? "QUEUED"
  };
}

function buildRetryIdempotencyKey(
  taskId: string,
  userId: string,
  seed: { requestedAt: string | null; triggerRunId: string | null }
) {
  const stableSeed = (seed.requestedAt ?? seed.triggerRunId ?? "no-analysis-request")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .slice(0, 64);
  return `task-analysis-retry-${taskId}-${userId}-${stableSeed}`;
}

async function getTriggerRunState(
  runId: string
): Promise<{ state: TriggerRunRuntimeState; status: string | null }> {
  return resolveTriggerRunState(runId);
}

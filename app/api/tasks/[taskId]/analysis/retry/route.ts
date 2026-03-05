import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { runs, tasks } from "@trigger.dev/sdk/v3";
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
};

type TriggerRunState = "active" | "terminal" | "missing" | "unknown";

type TaskAnalysisRetryRouteDependencies = {
  requireUser?: () => Promise<SessionUser>;
  isPersistenceReady?: () => boolean;
  getTriggerRunState?: (runId: string) => Promise<TriggerRunState>;
  enqueueTaskAnalysis?: (input: EnqueueAnalyzeTaskInput) => Promise<string | null>;
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
            "当前是生产环境，但后台任务密钥还是开发版（tr_dev_）。请先换成 tr_live_ 密钥再重试。"
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
    const canRetry = currentStatus === "failed" || currentProgress.canRetry;

    if (!canRetry) {
      return NextResponse.json(
        {
          ok: false,
          message: "系统还在处理中，暂时不用重试。请稍后再看一次进度。"
        },
        { status: 409 }
      );
    }

    const currentRunId = task.analysisTriggerRunId?.trim();
    if (currentRunId) {
      const runState = await (dependencies.getTriggerRunState ?? getTriggerRunState)(currentRunId);
      if (runState === "active") {
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
            analysisProgress: activeProgress,
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
      forcedPrimaryFileId: task.primaryRequirementFileId ?? null
    });

    await markTaskAnalysisPending({
      taskId: params.taskId,
      userId: user.id,
      primaryRequirementFileId: task.primaryRequirementFileId ?? null,
      triggerRunId
    });

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
      (error.message.includes("trigger") || error.message.includes("queue"))
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
      idempotencyKey: `task-analysis-retry-${input.taskId}-${input.userId}-${randomUUID()}`
    }
  );

  return typeof run?.id === "string" ? run.id : null;
}

async function getTriggerRunState(runId: string): Promise<TriggerRunState> {
  try {
    const run = await runs.retrieve(runId);
    const status = typeof run?.status === "string" ? run.status : "";
    const activeStatuses = new Set([
      "PENDING_VERSION",
      "QUEUED",
      "DEQUEUED",
      "EXECUTING",
      "WAITING",
      "DELAYED"
    ]);
    return activeStatuses.has(status) ? "active" : "terminal";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("not found")) {
      return "missing";
    }
    return "unknown";
  }
}

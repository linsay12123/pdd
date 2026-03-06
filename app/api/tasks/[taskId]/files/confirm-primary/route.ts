import { NextResponse } from "next/server";
import { tasks } from "@trigger.dev/sdk/v3";
import { requireCurrentSessionUser } from "@/src/lib/auth/current-user";
import { buildAnalysisProgressPayload } from "@/src/lib/tasks/analysis-progress";
import type { TaskWorkflowClassificationPayload } from "@/src/lib/tasks/request-task-file-upload";
import {
  getOwnedTaskSummary,
  listTaskFilesForWorkflow,
  markTaskAnalysisFailed,
  markTaskAnalysisPending
} from "@/src/lib/tasks/save-task-files";
import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import { getInvalidTriggerKeyReason } from "@/src/lib/trigger/key-guard";
import { startTaskAnalysisRun } from "@/src/lib/tasks/start-task-analysis-run";
import {
  resolveTriggerRunState,
  type TriggerRunRuntimeState
} from "@/src/lib/trigger/run-state";
import { TRIGGER_DEPLOYMENT_UNAVAILABLE_REASON } from "@/src/lib/tasks/analysis-runtime-cleanup";
import {
  toSessionTaskHumanizePayload,
  toSessionTaskPayload
} from "@/src/lib/tasks/session-task";
import type { SessionUser } from "@/src/types/auth";

type RouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

type ConfirmPrimaryBody = {
  fileId?: string;
};

type ConfirmPrimaryRouteDependencies = {
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
  startupProbeAttempts?: number;
  startupProbeDelayMs?: number;
  sleepImpl?: (ms: number) => Promise<void>;
};

export async function handleConfirmPrimaryFileRequest(
  request: Request,
  params: {
    taskId: string;
  },
  dependencies: ConfirmPrimaryRouteDependencies = {}
) {
  const body = (await request.json().catch(() => null)) as ConfirmPrimaryBody | null;
  const fileId = body?.fileId?.trim();

  if (!fileId) {
    return NextResponse.json(
      {
        ok: false,
        message: "请先告诉系统你选中的主任务文件。"
      },
      { status: 400 }
    );
  }

  try {
    if (!(dependencies.isPersistenceReady ?? shouldUseSupabasePersistence)()) {
      return NextResponse.json(
        {
          ok: false,
          message: "系统现在还没连上正式任务数据库，所以主任务文件暂时不能确认。"
        },
        { status: 503 }
      );
    }

    if (!process.env.TRIGGER_SECRET_KEY?.trim()) {
      return NextResponse.json(
        {
          ok: false,
          message: "后台任务密钥还没配置好，暂时不能启动主文件重分析。"
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
      throw new Error("TASK_NOT_FOUND");
    }

    const files = await listTaskFilesForWorkflow(params.taskId, user.id);
    const targetFile = files.find((file) => file.id === fileId);

    if (!targetFile) {
      throw new Error("FILE_NOT_FOUND");
    }

    const dispatchResult = await startTaskAnalysisRun({
      task,
      userId: user.id,
      source: "confirm_primary",
      forcedPrimaryFileId: fileId,
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
              ? "你已经确认了主任务文件，但后台环境里的分析版本当前还没准备好，所以这次不能真正开工。请先把后台发布完成，再重新分析。"
              : "你已经确认了主任务文件，但系统刚发出的后台分析任务连续两次都没真正启动起来。说明当前线上后台环境有问题，请稍后再试。"
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
        classification: buildPendingClassification(fileId, refreshedFiles),
        analysisStatus: "pending",
        analysisProgress,
        analysisRuntime: {
          state: dispatchResult.runtime.state,
          status: dispatchResult.runtime.status,
          detail:
            dispatchResult.runtime.state === "unknown"
              ? "后台重分析任务已受理，系统正在确认这一轮是否已经真正开始执行。"
              : dispatchResult.autoRecovered
                ? "第一张后台任务编号没有真正启动，系统刚刚已经自动换了一张新的后台编号。"
                : "后台重分析任务已受理，正在排队或准备执行。",
          autoRecovered: dispatchResult.autoRecovered,
          runId: dispatchResult.triggerRunId
        },
        analysis: refreshedTask?.analysisSnapshot ?? task.analysisSnapshot ?? null,
        ruleCard: null,
        outline: null,
        humanize: toSessionTaskHumanizePayload(refreshedTask ?? task),
        primaryRequirementFileId: fileId,
        message: dispatchResult.autoRecovered
          ? "主任务文件已确认。第一张后台任务没有真正启动，系统已经自动换了一张新的编号并继续分析。"
          : "主任务文件已确认，系统正在后台重新分析并生成新大纲。"
      },
      { status: 202 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json(
        {
          ok: false,
          message: "请先登录后再确认主任务文件。"
        },
        { status: 401 }
      );
    }

    if (
      error instanceof Error &&
      (error.message === "TASK_NOT_FOUND" || error.message === "FILE_NOT_FOUND")
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "没有找到你要确认的任务文件。"
        },
        { status: 404 }
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
          message: "系统已收到你的主文件确认，但后台重分析任务启动失败，请稍后重试。"
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "确认主任务文件失败"
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { taskId } = await context.params;
  return handleConfirmPrimaryFileRequest(request, { taskId });
}

function buildPendingClassification(
  primaryRequirementFileId: string,
  files: Array<{
    id: string;
    role: "requirement" | "background" | "irrelevant" | "unknown";
  }>
): TaskWorkflowClassificationPayload {
  return {
    primaryRequirementFileId,
    backgroundFileIds: files
      .filter((file) => file.id !== primaryRequirementFileId && file.role === "background")
      .map((file) => file.id),
    irrelevantFileIds: files
      .filter((file) => file.id !== primaryRequirementFileId && file.role === "irrelevant")
      .map((file) => file.id),
    needsUserConfirmation: false,
    reasoning: "你已确认主任务文件，系统正在后台重跑分析。"
  };
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

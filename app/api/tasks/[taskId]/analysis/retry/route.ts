import { NextResponse } from "next/server";
import { requireCurrentSessionUser } from "@/src/lib/auth/current-user";
import {
  buildAnalysisProgressPayload,
  type AnalysisStatus
} from "@/src/lib/tasks/analysis-progress";
import { resolveInlineAnalysisFailure } from "@/src/lib/tasks/inline-analysis-failure";
import { runInlineFirstOutline } from "@/src/lib/tasks/inline-first-outline";
import {
  getOwnedTaskSummary,
  listTaskFilesForWorkflow
} from "@/src/lib/tasks/save-task-files";
import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import {
  toSessionTaskHumanizePayload,
  toSessionTaskPayload
} from "@/src/lib/tasks/session-task";
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

type TaskAnalysisRetryRouteDependencies = {
  requireUser?: () => Promise<SessionUser>;
  isPersistenceReady?: () => boolean;
  getTriggerRunState?: (
    runId: string
  ) => Promise<{ state: TriggerRunRuntimeState; status: string | null }>;
  runInlineFirstOutline?: typeof runInlineFirstOutline;
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
    const canRetry = currentStatus === "failed" || currentProgress.canRetry;

    if (currentRuntime?.state === "active") {
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
          message: "上一轮分析还在后台运行，系统已避免重复处理。请稍后再看进度。"
        },
        { status: 202 }
      );
    }

    if (!canRetry) {
      return NextResponse.json(
        {
          ok: false,
          message: "系统还在处理中，暂时不用重试。请稍后再看一次进度。"
        },
        { status: 409 }
      );
    }

    const result = await (dependencies.runInlineFirstOutline ?? runInlineFirstOutline)({
      taskId: params.taskId,
      userId: user.id,
      source: "manual_retry",
      forcedPrimaryFileId: task.primaryRequirementFileId ?? null
    });

    const payload = {
      ok: result.analysisStatus === "succeeded",
      task: result.task,
      files: result.files,
      classification: result.classification,
      analysisStatus: result.analysisStatus,
      analysisProgress: result.analysisProgress,
      analysisRuntime: result.analysisRuntime,
      analysis: result.analysis,
      ruleCard: result.ruleCard,
      outline: result.outline,
      humanize: result.humanize,
      message:
        result.analysisStatus === "succeeded"
          ? "系统已经完成重新分析，并生成了新的第一版大纲。"
          : resolveInlineAnalysisFailure(
              result.taskSummary.analysisErrorMessage,
              result.analysis
            ).message
    };

    const failure = resolveInlineAnalysisFailure(
      result.taskSummary.analysisErrorMessage,
      result.analysis
    );

    return NextResponse.json(payload, {
      status: result.analysisStatus === "succeeded" ? 200 : failure.status
    });
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

async function getTriggerRunState(
  runId: string
): Promise<{ state: TriggerRunRuntimeState; status: string | null }> {
  return resolveTriggerRunState(runId);
}

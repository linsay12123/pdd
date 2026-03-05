import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { tasks } from "@trigger.dev/sdk/v3";
import { requireCurrentSessionUser } from "@/src/lib/auth/current-user";
import type { TaskWorkflowClassificationPayload } from "@/src/lib/tasks/request-task-file-upload";
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
  enqueueTaskAnalysis?: (input: {
    taskId: string;
    userId: string;
    forcedPrimaryFileId: string;
  }) => Promise<void>;
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

    await markTaskAnalysisPending({
      taskId: params.taskId,
      userId: user.id,
      primaryRequirementFileId: fileId
    });

    await (dependencies.enqueueTaskAnalysis ?? enqueueAnalyzeTaskWithTrigger)({
      taskId: params.taskId,
      userId: user.id,
      forcedPrimaryFileId: fileId
    });

    const refreshedTask = await getOwnedTaskSummary(params.taskId, user.id);
    const refreshedFiles = await listTaskFilesForWorkflow(params.taskId, user.id);

    return NextResponse.json(
      {
        ok: true,
        task: toSessionTaskPayload(refreshedTask ?? task),
        files: refreshedFiles,
        classification: buildPendingClassification(fileId, refreshedFiles),
        analysisStatus: "pending",
        analysis: refreshedTask?.analysisSnapshot ?? task.analysisSnapshot ?? null,
        ruleCard: null,
        outline: null,
        humanize: toSessionTaskHumanizePayload(refreshedTask ?? task),
        primaryRequirementFileId: fileId,
        message: "主任务文件已确认，系统正在后台重新分析并生成新大纲。"
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
      (error.message.includes("trigger") || error.message.includes("queue"))
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
  forcedPrimaryFileId: string;
}) {
  await tasks.trigger(
    "analyze-uploaded-task",
    {
      taskId: input.taskId,
      userId: input.userId,
      forcedPrimaryFileId: input.forcedPrimaryFileId
    },
    {
      queue: "task-analysis",
      concurrencyKey: `task-analysis-${input.taskId}`,
      idempotencyKey: `task-analysis-${input.taskId}-${input.userId}-${randomUUID()}`
    }
  );
}

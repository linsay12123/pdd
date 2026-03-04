import { NextResponse } from "next/server";
import type { OutlineScaffold } from "@/src/lib/ai/prompts/generate-outline";
import { isMeaningfulOutline } from "@/src/lib/ai/outline-quality";
import {
  analyzeUploadedTaskWithOpenAI,
  type ModelReadyTaskFile
} from "@/src/lib/ai/services/analyze-uploaded-task";
import { requireCurrentSessionUser } from "@/src/lib/auth/current-user";
import type { TaskWorkflowClassificationPayload } from "@/src/lib/tasks/request-task-file-upload";
import {
  getOwnedTaskSummary,
  listTaskFilesForModel,
  persistTaskModelAnalysis
} from "@/src/lib/tasks/save-task-files";
import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import {
  toSessionTaskHumanizePayload,
  toSessionTaskPayload
} from "@/src/lib/tasks/session-task";
import type { TaskAnalysisSnapshot } from "@/src/types/tasks";
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
  analyzeTask?: (input: {
    taskId: string;
    userId: string;
    specialRequirements: string;
    files: ModelReadyTaskFile[];
    forcedPrimaryFileId: string;
  }) => Promise<{
    analysis: TaskAnalysisSnapshot;
    outline: OutlineScaffold | null;
  }>;
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

    const user = await (dependencies.requireUser ?? requireCurrentSessionUser)();
    const task = await getOwnedTaskSummary(params.taskId, user.id);

    if (!task) {
      throw new Error("TASK_NOT_FOUND");
    }

    const files = await listTaskFilesForModel(params.taskId, user.id);
    const targetFile = files.find((file) => file.id === fileId);

    if (!targetFile) {
      throw new Error("FILE_NOT_FOUND");
    }

    const analyzeTask = dependencies.analyzeTask ?? analyzeUploadedTaskFromFiles;
    const analyzed = await analyzeTask({
      taskId: params.taskId,
      userId: user.id,
      specialRequirements: task.specialRequirements ?? "",
      files,
      forcedPrimaryFileId: fileId
    });

    if (!analyzed.outline?.sections.length || !isMeaningfulOutline(analyzed.outline)) {
      throw new Error("模型没有返回可展示的大纲，请重试。");
    }

    const result = await persistTaskModelAnalysis({
      taskId: params.taskId,
      userId: user.id,
      analysis: {
        ...analyzed.analysis,
        chosenTaskFileId: fileId,
        needsUserConfirmation: false
      },
      outline: analyzed.outline
    });

    return NextResponse.json({
      ok: true,
      task: toSessionTaskPayload(result.task),
      files: result.files,
      classification: buildConfirmedClassification(fileId, result.files),
      analysis: result.analysis,
      ruleCard: result.ruleCard,
      outline: result.outline,
      humanize: toSessionTaskHumanizePayload(result.task),
      primaryRequirementFileId: fileId,
      message: "主任务文件已确认，模型已重新生成第一版大纲。"
    });
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

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "确认主任务文件失败"
      },
      { status: 500 }
    );
  }
}

async function analyzeUploadedTaskFromFiles(input: {
  taskId: string;
  userId: string;
  specialRequirements: string;
  files: ModelReadyTaskFile[];
  forcedPrimaryFileId: string;
}) {
  return analyzeUploadedTaskWithOpenAI({
    files: input.files,
    specialRequirements: input.specialRequirements,
    forcedPrimaryFileId: input.forcedPrimaryFileId
  });
}

export async function POST(request: Request, context: RouteContext) {
  const { taskId } = await context.params;
  return handleConfirmPrimaryFileRequest(request, { taskId });
}

function buildConfirmedClassification(
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
    reasoning: "The user confirmed the primary requirement file, so the model re-ran the analysis."
  };
}

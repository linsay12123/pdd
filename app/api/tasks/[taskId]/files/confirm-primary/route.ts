import { NextResponse } from "next/server";
import { requireCurrentSessionUser } from "@/src/lib/auth/current-user";
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
  runInlineFirstOutline?: typeof runInlineFirstOutline;
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

    const files = await listTaskFilesForWorkflow(params.taskId, user.id);
    const targetFile = files.find((file) => file.id === fileId);

    if (!targetFile) {
      throw new Error("FILE_NOT_FOUND");
    }

    const result = await (dependencies.runInlineFirstOutline ?? runInlineFirstOutline)({
      taskId: params.taskId,
      userId: user.id,
      source: "confirm_primary",
      forcedPrimaryFileId: fileId
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
      primaryRequirementFileId: fileId,
      message:
        result.analysisStatus === "succeeded"
          ? "主任务文件已确认，系统已经完成重新分析并生成新大纲。"
          : mapInlineFailureMessage(result.taskSummary.analysisErrorMessage, result.analysis)
    };

    return NextResponse.json(payload, {
      status: result.analysisStatus === "succeeded" ? 200 : 502
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

function mapInlineFailureMessage(
  analysisErrorMessage: string | null | undefined,
  analysis: TaskAnalysisSnapshot | null
) {
  const warning = analysis?.warnings?.find((item) => item.startsWith("analysis_failed:"));
  const code =
    analysisErrorMessage?.trim() ||
    warning?.replace("analysis_failed:", "")?.trim() ||
    "";

  if (
    code === "MODEL_ANALYSIS_INCOMPLETE" ||
    code === "MODEL_ANALYSIS_INCOMPLETE_AFTER_RETRY" ||
    code === "MODEL_RETURNED_EMPTY_OUTLINE" ||
    code === "MODEL_RETURNED_EMPTY_OUTLINE_AFTER_RETRY"
  ) {
    return "系统已经收到了你的主文件确认，但模型这次返回内容不完整。请直接再试一次，不用重新上传文件。";
  }

  if (code === "MODEL_ANALYSIS_TIMEOUT") {
    return "系统已经收到了你的主文件确认，但这次分析时间过长。请直接再试一次，不用重新上传文件。";
  }

  if (code === "INLINE_ANALYSIS_DID_NOT_FINISH") {
    return "系统已经收到了你的主文件确认，但这次分析没有正常完成。请直接再试一次，不用重新上传文件。";
  }

  if (code.startsWith("OpenAI request failed with status")) {
    return "模型服务暂时不稳定，请稍后再试。";
  }

  return "系统已经收到了你的主文件确认，但这次分析失败了。请直接再试一次，不用重新上传文件。";
}

import { NextResponse } from "next/server";
import { classifyFilesByHeuristics } from "@/src/lib/ai/services/classify-files";
import { requireCurrentSessionUser } from "@/src/lib/auth/current-user";
import { extractTextFromUpload } from "@/src/lib/files/extract-text";
import {
  applyFileClassification,
  getOwnedTaskSummary,
  saveTaskFiles
} from "@/src/lib/tasks/save-task-files";
import { toSessionTaskPayload } from "@/src/lib/tasks/session-task";
import type { SessionUser } from "@/src/types/auth";

type RouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

type TaskFileUploadRouteDependencies = {
  requireUser?: () => Promise<SessionUser>;
};

export async function handleTaskFileUploadRequest(
  request: Request,
  params: {
    taskId: string;
  },
  dependencies: TaskFileUploadRouteDependencies = {}
) {
  try {
    const user = await (dependencies.requireUser ?? requireCurrentSessionUser)();
    const task = await getOwnedTaskSummary(params.taskId, user.id);

    if (!task) {
      return NextResponse.json(
        {
          ok: false,
          message: "没有找到这个任务，暂时不能上传文件。"
        },
        { status: 404 }
      );
    }

    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File && value.size > 0);

    if (files.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "请先选择至少一个文件再继续。"
        },
        { status: 400 }
      );
    }

    const extractedFiles = await Promise.all(
      files.map(async (file) => ({
        originalFilename: file.name,
        extractedText: await extractTextFromUpload(file)
      }))
    );

    const persistedFiles = await saveTaskFiles({
      taskId: params.taskId,
      userId: user.id,
      files: extractedFiles
    });
    const classification = classifyFilesByHeuristics(
      persistedFiles.map((file) => ({
        id: file.id,
        originalFilename: file.originalFilename,
        extractedText: file.extractedText
      }))
    );
    const persistedResult = await applyFileClassification({
      taskId: params.taskId,
      userId: user.id,
      classification
    });

    return NextResponse.json(
      {
        ok: true,
        task: toSessionTaskPayload(persistedResult.task),
        files: persistedResult.files,
        classification,
        ruleCard: persistedResult.ruleCard,
        outline: persistedResult.outline,
        message: classification.needsUserConfirmation
          ? "系统发现多个文件都像任务书，请先确认主任务文件。"
          : "文件已上传，系统已识别主任务文件并生成第一版大纲。"
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json(
        {
          ok: false,
          message: "请先登录后再上传文件。"
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "上传文件失败"
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  const params = await context.params;
  return handleTaskFileUploadRequest(request, params);
}

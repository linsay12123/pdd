import { NextResponse } from "next/server";
import { uploadOpenAIUserFile } from "@/src/lib/ai/openai-file-client";
import { extractTextFromImageWithVision } from "@/src/lib/ai/services/extract-text-from-image";
import { requireCurrentSessionUser } from "@/src/lib/auth/current-user";
import { detectSupportedFileKind } from "@/src/lib/files/file-kind";
import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import { runInlineFirstOutline } from "@/src/lib/tasks/inline-first-outline";
import {
  getOwnedTaskSummary,
  saveTaskFiles,
  updateTaskFileOpenAIMetadata
} from "@/src/lib/tasks/save-task-files";
import {
  toSessionTaskHumanizePayload,
  toSessionTaskPayload
} from "@/src/lib/tasks/session-task";
import type { TaskAnalysisSnapshot } from "@/src/types/tasks";
import type { SessionUser } from "@/src/types/auth";

export const maxDuration = 300;

type RouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

type TaskFileUploadRouteDependencies = {
  requireUser?: () => Promise<SessionUser>;
  isPersistenceReady?: () => boolean;
  runInlineFirstOutline?: typeof runInlineFirstOutline;
  maxFileCount?: number;
  maxFileBytes?: number;
};

const DEFAULT_MAX_FILE_COUNT = 10;
const DEFAULT_MAX_FILE_BYTES = 25 * 1024 * 1024;

export async function handleTaskFileUploadRequest(
  request: Request,
  params: {
    taskId: string;
  },
  dependencies: TaskFileUploadRouteDependencies = {}
) {
  const requestStartedAt = Date.now();

  try {
    if (!(dependencies.isPersistenceReady ?? shouldUseSupabasePersistence)()) {
      return NextResponse.json(
        {
          ok: false,
          message: "系统现在还没连上正式任务数据库，所以文件暂时不能真的上传分析。"
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

    const maxFileCount = Number.isFinite(dependencies.maxFileCount)
      ? Number(dependencies.maxFileCount)
      : Number.parseInt(process.env.TASK_UPLOAD_MAX_FILE_COUNT ?? "", 10) || DEFAULT_MAX_FILE_COUNT;
    if (files.length > maxFileCount) {
      return NextResponse.json(
        {
          ok: false,
          message: `一次最多上传 ${maxFileCount} 个文件，请删掉一部分再试。`
        },
        { status: 400 }
      );
    }

    const maxFileBytes = Number.isFinite(dependencies.maxFileBytes)
      ? Number(dependencies.maxFileBytes)
      : Number.parseInt(process.env.TASK_UPLOAD_MAX_FILE_BYTES ?? "", 10) || DEFAULT_MAX_FILE_BYTES;
    const oversizedFile = files.find((file) => file.size > maxFileBytes);
    if (oversizedFile) {
      const maxFileMb = (maxFileBytes / (1024 * 1024)).toFixed(0);
      return NextResponse.json(
        {
          ok: false,
          message: `文件 ${oversizedFile.name} 超过 ${maxFileMb}MB 上限，请压缩后再上传。`
        },
        { status: 400 }
      );
    }

    const preparedFiles = await Promise.all(
      files.map(async (file) => {
        const fileKind = detectSupportedFileKind(file.name);
        let extractedText = "";
        const extractionWarnings: string[] = [];
        let extractionMethod = "local_text";

        if (fileKind === "pdf") {
          extractedText = `[pdf transport-only: ${file.name}]`;
          extractionMethod = "transport_only_pdf";
          extractionWarnings.push(
            "PDF 已直接交给模型读取，已跳过本地文字提取以提升稳定性和速度。"
          );
        } else {
          extractedText = await extractTextFromUploadLazily(file);
        }

        if (extractedText.startsWith("[image")) {
          extractionMethod = "image_placeholder";
          try {
            const arrayBuffer = await file.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString("base64");
            const visionText = await extractTextFromImageWithVision(base64, file.name);
            if (visionText && !visionText.includes("[no text detected]")) {
              extractedText = visionText;
              extractionMethod = "openai_vision";
            } else {
              extractionWarnings.push("本地没有稳定提取到图片文字，分析时会继续交给模型直接阅读。");
            }
          } catch {
            extractionWarnings.push("图片文字提取失败，分析时会继续交给模型直接阅读。");
          }
        } else if (
          extractedText.startsWith("[extraction pending") ||
          extractedText.startsWith("[image-based content")
        ) {
          extractionWarnings.push("本地没有稳定提取到完整文字，分析时会继续交给模型直接阅读。");
          extractionMethod = "partial_or_failed_extraction";
        }

        const body = Buffer.from(await file.arrayBuffer());
        let openaiFileId: string | null = null;
        let openaiUploadStatus: "pending" | "uploaded" | "failed" = "pending";

        try {
          const uploaded = await uploadOpenAIUserFile({
            filename: file.name,
            body,
            contentType: file.type || "application/octet-stream"
          });
          openaiFileId = uploaded.id;
          openaiUploadStatus = "uploaded";
        } catch {
          openaiUploadStatus = "failed";
          extractionWarnings.push("原文件上传到 OpenAI 失败，本次只能依赖可用的原样文本或图片输入。");
        }

        return {
          originalFilename: file.name,
          contentType: file.type || "application/octet-stream",
          body,
          extractedText,
          extractionMethod,
          extractionWarnings,
          openaiFileId,
          openaiUploadStatus
        };
      })
    );

    console.info("[file-upload] prepared-files", {
      taskId: params.taskId,
      userId: user.id,
      elapsedMs: Date.now() - requestStartedAt,
      files: preparedFiles.map((file) => ({
        filename: file.originalFilename,
        extractionMethod: file.extractionMethod,
        extractedTextLength: file.extractedText.length,
        openaiUploadStatus: file.openaiUploadStatus,
        hasOpenAIFileId: Boolean(file.openaiFileId),
        warningCount: file.extractionWarnings.length
      }))
    });

    const persistedFiles = await saveTaskFiles({
      taskId: params.taskId,
      userId: user.id,
      files: preparedFiles
    });

    await updateTaskFileOpenAIMetadata({
      taskId: params.taskId,
      userId: user.id,
      files: persistedFiles.map((file, index) => ({
        id: file.id,
        openaiFileId: preparedFiles[index]?.openaiFileId ?? null,
        openaiUploadStatus: preparedFiles[index]?.openaiUploadStatus ?? "failed",
        extractionMethod: preparedFiles[index]?.extractionMethod,
        extractionWarnings: preparedFiles[index]?.extractionWarnings ?? []
      }))
    });

    const result = await (dependencies.runInlineFirstOutline ?? runInlineFirstOutline)({
      taskId: params.taskId,
      userId: user.id,
      source: "upload"
    });

    if (result.analysisStatus === "succeeded") {
      return NextResponse.json(
        {
          ok: true,
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
          message: "文件已上传，系统已经完成分析并生成第一版大纲。"
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
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
        message: mapInlineFailureMessage(result.taskSummary.analysisErrorMessage, result.analysis)
      },
      { status: 502 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[file-upload] 上传文件失败:", {
      errorMessage
    });

    if (errorMessage === "AUTH_REQUIRED") {
      return NextResponse.json(
        {
          ok: false,
          message: "请先登录后再上传文件。"
        },
        { status: 401 }
      );
    }

    if (errorMessage === "ACCOUNT_FROZEN") {
      return NextResponse.json(
        {
          ok: false,
          message: "账号已被冻结，请联系管理员。"
        },
        { status: 403 }
      );
    }

    if (
      errorMessage.startsWith("OpenAI file upload failed with status") ||
      errorMessage.startsWith("OpenAI request failed with status")
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "模型服务暂时不稳定，请稍后再试一次。"
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message: "上传文件失败，请重试一次。如果连续失败，请联系人工支持。"
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  const params = await context.params;
  return handleTaskFileUploadRequest(request, params);
}

async function extractTextFromUploadLazily(file: File) {
  const { extractTextFromUpload } = await import("@/src/lib/files/extract-text");
  return extractTextFromUpload(file);
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
    return "系统已经读到你上传的文件，但模型这次返回内容不完整。请直接再试一次，不用重新上传。";
  }

  if (code === "MODEL_ANALYSIS_TIMEOUT") {
    return "系统已经开始分析你上传的文件，但这次处理时间过长。请直接再试一次，不用重新上传。";
  }

  if (code === "INLINE_ANALYSIS_DID_NOT_FINISH") {
    return "这次分析没有正常完成。你可以直接再试一次，不用重新上传文件。";
  }

  if (code.startsWith("OpenAI request failed with status")) {
    return "模型服务暂时不稳定，请稍后再试。";
  }

  return "系统分析失败了，请直接再试一次，不用重新上传文件。";
}

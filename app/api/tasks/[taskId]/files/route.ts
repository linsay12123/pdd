import { NextResponse } from "next/server";
import { uploadOpenAIUserFile } from "@/src/lib/ai/openai-file-client";
import { isMeaningfulOutline } from "@/src/lib/ai/outline-quality";
import {
  analyzeUploadedTaskWithOpenAI,
  type ModelReadyTaskFile
} from "@/src/lib/ai/services/analyze-uploaded-task";
import { extractTextFromImageWithVision } from "@/src/lib/ai/services/extract-text-from-image";
import { requireCurrentSessionUser } from "@/src/lib/auth/current-user";
import { detectSupportedFileKind } from "@/src/lib/files/file-kind";
import { extractTextFromUpload } from "@/src/lib/files/extract-text";
import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import {
  getOwnedTaskSummary,
  markTaskAnalysisFailed,
  persistTaskModelAnalysis,
  saveTaskFiles,
  updateTaskFileOpenAIMetadata
} from "@/src/lib/tasks/save-task-files";
import {
  toSessionTaskHumanizePayload,
  toSessionTaskPayload
} from "@/src/lib/tasks/session-task";
import type { OutlineScaffold } from "@/src/lib/ai/prompts/generate-outline";
import type { TaskAnalysisSnapshot } from "@/src/types/tasks";
import type { SessionUser } from "@/src/types/auth";

export const maxDuration = 60;

type RouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

type TaskFileUploadRouteDependencies = {
  requireUser?: () => Promise<SessionUser>;
  isPersistenceReady?: () => boolean;
  analyzeTimeoutMs?: number;
  analyzeTask?: (input: {
    taskId: string;
    userId: string;
    specialRequirements: string;
    files: ModelReadyTaskFile[];
    forcedPrimaryFileId?: string | null;
  }) => Promise<{
    analysis: TaskAnalysisSnapshot;
    outline: OutlineScaffold | null;
  }>;
};

export async function handleTaskFileUploadRequest(
  request: Request,
  params: {
    taskId: string;
  },
  dependencies: TaskFileUploadRouteDependencies = {}
) {
  let resolvedUserId: string | null = null;
  let taskIdForFailure: string | null = null;
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
    resolvedUserId = user.id;
    taskIdForFailure = params.taskId;
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
          extractedText = await extractTextFromUpload(file);
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

    const analyzeTask = dependencies.analyzeTask ?? analyzeUploadedTaskFromFiles;
    const modelFiles = persistedFiles.map((file, index) => ({
      ...file,
      rawBody: preparedFiles[index]?.body ?? null,
      contentType: preparedFiles[index]?.contentType ?? file.contentType,
      openaiFileId: preparedFiles[index]?.openaiFileId ?? file.openaiFileId ?? null,
      extractedText: preparedFiles[index]?.extractedText ?? file.extractedText
    }));
    const analyzeStartedAt = Date.now();
    const analyzed = await withTimeout(
      analyzeTask({
        taskId: params.taskId,
        userId: user.id,
        specialRequirements: task.specialRequirements ?? "",
        files: modelFiles
      }),
      dependencies.analyzeTimeoutMs ?? 45_000,
      "MODEL_ANALYSIS_TIMEOUT"
    );

    console.info("[file-upload] analyze-finished", {
      taskId: params.taskId,
      userId: user.id,
      elapsedMs: Date.now() - analyzeStartedAt
    });

    if (
      !analyzed.analysis.needsUserConfirmation &&
      (!analyzed.outline?.sections.length || !isMeaningfulOutline(analyzed.outline))
    ) {
      throw new Error("模型没有返回可展示的大纲，请重试。");
    }

    const persistedResult = await persistTaskModelAnalysis({
      taskId: params.taskId,
      userId: user.id,
      analysis: analyzed.analysis,
      outline: analyzed.outline
    });

    return NextResponse.json(
      {
        ok: true,
        task: toSessionTaskPayload(persistedResult.task),
        files: persistedResult.files,
        classification: {
          primaryRequirementFileId: persistedResult.analysis?.chosenTaskFileId ?? null,
          backgroundFileIds: persistedResult.analysis?.supportingFileIds ?? [],
          irrelevantFileIds: persistedResult.analysis?.ignoredFileIds ?? [],
          needsUserConfirmation: persistedResult.analysis?.needsUserConfirmation ?? false,
          reasoning: persistedResult.analysis?.reasoning ?? "模型已完成文件分析。"
        },
        analysis: persistedResult.analysis,
        ruleCard: persistedResult.ruleCard,
        outline: persistedResult.outline,
        humanize: toSessionTaskHumanizePayload(persistedResult.task),
        message: persistedResult.analysis?.needsUserConfirmation
          ? "模型已阅读全部材料，但它认为主任务文件还需要你确认。"
          : "文件已上传，模型已读完材料并生成第一版大纲。"
      },
      { status: 201 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const diagnostics =
      typeof error === "object" && error !== null && "diagnostics" in error
        ? (error as { diagnostics?: unknown }).diagnostics
        : null;
    const missingFields =
      typeof error === "object" && error !== null && "missingFields" in error
        ? (error as { missingFields?: unknown }).missingFields
        : null;
    console.error("[file-upload] 上传文件失败:", {
      errorMessage,
      missingFields,
      diagnostics
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

    if (resolvedUserId && taskIdForFailure) {
      try {
        await markTaskAnalysisFailed({
          taskId: taskIdForFailure,
          userId: resolvedUserId,
          reason: errorMessage
        });
      } catch (persistError) {
        console.error("[file-upload] 记录分析失败状态失败:", persistError);
      }
    }

    if (
      errorMessage === "MODEL_ANALYSIS_INCOMPLETE_AFTER_RETRY" ||
      errorMessage === "MODEL_RETURNED_EMPTY_OUTLINE_AFTER_RETRY" ||
      errorMessage === "MODEL_ANALYSIS_INCOMPLETE" ||
      errorMessage === "MODEL_RETURNED_EMPTY_OUTLINE" ||
      errorMessage === "MODEL_ANALYSIS_TIMEOUT"
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            errorMessage === "MODEL_ANALYSIS_TIMEOUT"
              ? "系统已经开始分析你上传的文件，但这次处理超时了。请再点一次上传重试。"
              : "系统已经读到你上传的文件，但模型这次返回内容不完整。系统已自动重试一次，仍未成功，请再点一次上传重试。"
        },
        { status: 502 }
      );
    }

    if (errorMessage.startsWith("OpenAI request failed with status")) {
      return NextResponse.json(
        {
          ok: false,
          message: "模型服务暂时不稳定，请稍后再试一次。"
        },
        { status: 502 }
      );
    }

    if (errorMessage.includes("大纲")) {
      return NextResponse.json(
        {
          ok: false,
          message: errorMessage
        },
        { status: 500 }
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

async function analyzeUploadedTaskFromFiles(input: {
  taskId: string;
  userId: string;
  specialRequirements: string;
  files: ModelReadyTaskFile[];
  forcedPrimaryFileId?: string | null;
}) {
  return analyzeUploadedTaskWithOpenAI({
    files: input.files,
    specialRequirements: input.specialRequirements,
    forcedPrimaryFileId: input.forcedPrimaryFileId
  });
}

export async function POST(request: Request, context: RouteContext) {
  const params = await context.params;
  return handleTaskFileUploadRequest(request, params);
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutCode: string
) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutCode));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

import { NextResponse } from "next/server";
import { tasks } from "@trigger.dev/sdk/v3";
import { uploadOpenAIUserFile } from "@/src/lib/ai/openai-file-client";
import { extractTextFromImageWithVision } from "@/src/lib/ai/services/extract-text-from-image";
import { requireCurrentSessionUser } from "@/src/lib/auth/current-user";
import { detectSupportedFileKind } from "@/src/lib/files/file-kind";
import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import { buildAnalysisProgressPayload } from "@/src/lib/tasks/analysis-progress";
import { startTaskAnalysisRun } from "@/src/lib/tasks/start-task-analysis-run";
import {
  getOwnedTaskSummary,
  listTaskFilesForWorkflow,
  markTaskAnalysisFailed,
  markTaskAnalysisPending,
  saveTaskFiles,
  updateTaskFileOpenAIMetadata
} from "@/src/lib/tasks/save-task-files";
import { getInvalidTriggerKeyReason } from "@/src/lib/trigger/key-guard";
import {
  resolveTriggerRunState,
  type TriggerRunRuntimeState
} from "@/src/lib/trigger/run-state";
import { TRIGGER_DEPLOYMENT_UNAVAILABLE_REASON } from "@/src/lib/tasks/analysis-runtime-cleanup";
import type { TaskWorkflowClassificationPayload } from "@/src/lib/tasks/request-task-file-upload";
import {
  toSessionTaskHumanizePayload,
  toSessionTaskPayload
} from "@/src/lib/tasks/session-task";
import type { TaskAnalysisSnapshot } from "@/src/types/tasks";
import type { SessionUser } from "@/src/types/auth";

export const maxDuration = 60;

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

type TaskFileUploadRouteDependencies = {
  requireUser?: () => Promise<SessionUser>;
  isPersistenceReady?: () => boolean;
  getTriggerRunState?: (
    runId: string
  ) => Promise<{ state: TriggerRunRuntimeState; status: string | null }>;
  enqueueTaskAnalysis?: (input: EnqueueAnalyzeTaskInput) => Promise<string | null>;
  maxFileCount?: number;
  maxFileBytes?: number;
  startupProbeAttempts?: number;
  startupProbeDelayMs?: number;
  sleepImpl?: (ms: number) => Promise<void>;
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

    if (!process.env.TRIGGER_SECRET_KEY?.trim()) {
      return NextResponse.json(
        {
          ok: false,
          message: "后台任务密钥还没配置好，暂时不能启动上传分析。"
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
            "当前是生产环境，但后台任务密钥还是开发版（tr_dev_）。请先换成生产密钥（通常是 tr_prod_）再上传。"
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

    const dispatchResult = await startTaskAnalysisRun({
      task,
      userId: user.id,
      source: "upload",
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
              ? "文件已经收到了，但后台环境里的分析版本当前还没准备好，所以这次不能真正开工。请先把后台发布完成，再重新分析。"
              : "文件已经收到了，但系统刚发出的后台分析任务连续两次都没真正启动起来。说明当前线上后台环境有问题，请稍后再试。"
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
        classification: buildClassificationFromAnalysis(
          refreshedTask?.analysisSnapshot ?? null
        ),
        analysisStatus: "pending",
        analysisProgress,
        analysisRuntime: {
          state: dispatchResult.runtime.state,
          status: dispatchResult.runtime.status,
          detail:
            dispatchResult.runtime.state === "unknown"
              ? "后台任务已受理，系统正在确认这一轮是否已经真正开始执行。"
              : dispatchResult.autoRecovered
                ? "第一张后台任务编号没有真正启动，系统刚刚已经自动换了一张新的后台编号。"
                : "后台任务已受理，正在排队或准备执行。",
          autoRecovered: dispatchResult.autoRecovered,
          runId: dispatchResult.triggerRunId
        },
        analysis: refreshedTask?.analysisSnapshot ?? null,
        ruleCard: null,
        outline: null,
        humanize: toSessionTaskHumanizePayload(refreshedTask ?? task),
        message: dispatchResult.autoRecovered
          ? "文件已上传。第一张后台任务没有真正启动，系统已经自动换了一张新的编号并继续分析。"
          : "文件已上传，系统正在后台分析并生成第一版大纲。"
      },
      { status: 202 }
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

    if (
      errorMessage.includes("trigger") ||
      errorMessage.includes("queue") ||
      errorMessage.includes("TRIGGER") ||
      errorMessage === "TRIGGER_RUN_ID_MISSING"
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "文件已上传，但后台分析任务启动失败。请稍后重试一次。"
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

function buildClassificationFromAnalysis(
  analysis: TaskAnalysisSnapshot | null
): TaskWorkflowClassificationPayload {
  return {
    primaryRequirementFileId: analysis?.chosenTaskFileId ?? null,
    backgroundFileIds: analysis?.supportingFileIds ?? [],
    irrelevantFileIds: analysis?.ignoredFileIds ?? [],
    needsUserConfirmation: analysis?.needsUserConfirmation ?? false,
    reasoning: analysis?.reasoning ?? "系统正在分析全部文件。"
  };
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

async function getTriggerRunState(
  runId: string
): Promise<{ state: TriggerRunRuntimeState; status: string | null }> {
  return resolveTriggerRunState(runId);
}

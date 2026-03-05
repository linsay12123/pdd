import { task } from "@trigger.dev/sdk/v3";
import { isMeaningfulOutline } from "@/src/lib/ai/outline-quality";
import { analyzeUploadedTaskWithOpenAI } from "@/src/lib/ai/services/analyze-uploaded-task";
import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import {
  getOwnedTaskSummary,
  listTaskFilesForModel,
  markTaskAnalysisFailed,
  persistTaskModelAnalysis
} from "@/src/lib/tasks/save-task-files";

export type AnalyzeUploadedTaskJobInput = {
  taskId: string;
  userId: string;
  forcedPrimaryFileId?: string | null;
};

const ANALYZE_JOB_MAX_RUNTIME_MS = 45 * 60 * 1000;

export const analyzeUploadedTaskJob = task({
  id: "analyze-uploaded-task",
  run: async (payload: AnalyzeUploadedTaskJobInput) => {
    return runAnalyzeUploadedTaskPipeline(payload);
  }
});

export async function runAnalyzeUploadedTaskPipeline(
  input: AnalyzeUploadedTaskJobInput
) {
  if (!shouldUseSupabasePersistence()) {
    throw new Error("REAL_PERSISTENCE_REQUIRED");
  }

  const startedAt = Date.now();

  try {
    const taskSummary = await getOwnedTaskSummary(input.taskId, input.userId);
    if (!taskSummary) {
      throw new Error("TASK_NOT_FOUND");
    }

    const files = await listTaskFilesForModel(input.taskId, input.userId);
    if (files.length === 0) {
      throw new Error("TASK_FILES_NOT_FOUND");
    }

    const analyzed = await withTimeout(
      analyzeUploadedTaskWithOpenAI({
        files,
        specialRequirements: taskSummary.specialRequirements ?? "",
        forcedPrimaryFileId: input.forcedPrimaryFileId ?? null
      }),
      ANALYZE_JOB_MAX_RUNTIME_MS,
      "MODEL_ANALYSIS_TIMEOUT"
    );

    if (
      !analyzed.analysis.needsUserConfirmation &&
      (!analyzed.outline?.sections.length || !isMeaningfulOutline(analyzed.outline))
    ) {
      throw new Error("MODEL_RETURNED_EMPTY_OUTLINE");
    }

    const persisted = await persistTaskModelAnalysis({
      taskId: input.taskId,
      userId: input.userId,
      analysis: analyzed.analysis,
      outline: analyzed.outline
    });

    console.info("[analysis-job] completed", {
      taskId: input.taskId,
      userId: input.userId,
      elapsedMs: Date.now() - startedAt,
      needsUserConfirmation: persisted.analysis?.needsUserConfirmation ?? false,
      hasOutline: Boolean(persisted.outline?.sections?.length)
    });

    return {
      taskId: input.taskId,
      userId: input.userId,
      analysisStatus: "succeeded"
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    try {
      await markTaskAnalysisFailed({
        taskId: input.taskId,
        userId: input.userId,
        reason
      });
    } catch (persistError) {
      console.error("[analysis-job] failed to persist analysis failure", {
        taskId: input.taskId,
        userId: input.userId,
        reason,
        persistError: persistError instanceof Error ? persistError.message : String(persistError)
      });
    }

    console.error("[analysis-job] failed", {
      taskId: input.taskId,
      userId: input.userId,
      elapsedMs: Date.now() - startedAt,
      reason
    });
    throw error;
  }
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

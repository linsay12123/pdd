import { analyzeUploadedTaskWithOpenAI } from "@/src/lib/ai/services/analyze-uploaded-task";
import { requireFormalPersistence, shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import {
  getOwnedTaskSummary,
  listTaskFilesForModel,
  markTaskAnalysisFailed,
  markTaskAnalysisStarted,
  persistTaskPartialModelAnalysis,
  persistTaskModelAnalysis
} from "@/src/lib/tasks/save-task-files";
import type { TaskAnalysisSnapshot } from "@/src/types/tasks";

export type AnalyzeUploadedTaskJobInput = {
  taskId: string;
  userId: string;
  forcedPrimaryFileId?: string | null;
  seedAnalysis?: TaskAnalysisSnapshot | null;
};

const ANALYZE_JOB_MAX_RUNTIME_MS = 45 * 60 * 1000;

export async function runAnalyzeUploadedTaskPipeline(
  input: AnalyzeUploadedTaskJobInput
) {
  if (!shouldUseSupabasePersistence()) {
    requireFormalPersistence();
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

    console.info("[analysis-inline] pipeline-started", {
      taskId: input.taskId,
      userId: input.userId,
      fileCount: files.length,
      forcedPrimaryFileId: input.forcedPrimaryFileId ?? null
    });

    await markTaskAnalysisStarted({
      taskId: input.taskId,
      userId: input.userId
    });

    console.info("[analysis-inline] persisted-started", {
      taskId: input.taskId,
      userId: input.userId
    });

    const analyzed = await withTimeout(
      analyzeUploadedTaskWithOpenAI({
        files,
        specialRequirements: taskSummary.specialRequirements ?? "",
        forcedPrimaryFileId: input.forcedPrimaryFileId ?? null,
        seedAnalysis: input.seedAnalysis ?? null
      }),
      ANALYZE_JOB_MAX_RUNTIME_MS,
      "MODEL_ANALYSIS_TIMEOUT"
    );

    const persisted = await persistTaskModelAnalysis({
      taskId: input.taskId,
      userId: input.userId,
      analysis: analyzed.analysis,
      outline: analyzed.outline
    });

    console.info("[analysis-inline] completed", {
      taskId: input.taskId,
      userId: input.userId,
      elapsedMs: Date.now() - startedAt,
      needsUserConfirmation: persisted.analysis?.needsUserConfirmation ?? false,
      hasOutline: Boolean(persisted.outline?.sections?.length)
    });

    return {
      taskId: input.taskId,
      userId: input.userId,
      analysisStatus: "succeeded" as const
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const partialAnalysis =
      error &&
      typeof error === "object" &&
      "partialAnalysis" in error &&
      error.partialAnalysis &&
      typeof error.partialAnalysis === "object"
        ? (error.partialAnalysis as TaskAnalysisSnapshot)
        : null;

    if (partialAnalysis) {
      try {
        await persistTaskPartialModelAnalysis({
          taskId: input.taskId,
          userId: input.userId,
          analysis: partialAnalysis
        });
      } catch (partialPersistError) {
        console.error("[analysis-inline] failed-to-persist-partial-analysis", {
          taskId: input.taskId,
          userId: input.userId,
          reason,
          partialPersistError:
            partialPersistError instanceof Error
              ? partialPersistError.message
              : String(partialPersistError)
        });
      }
    }

    try {
      await markTaskAnalysisFailed({
        taskId: input.taskId,
        userId: input.userId,
        reason
      });
    } catch (persistError) {
      console.error("[analysis-inline] failed-to-persist", {
        taskId: input.taskId,
        userId: input.userId,
        reason,
        persistError: persistError instanceof Error ? persistError.message : String(persistError)
      });
    }

    console.error("[analysis-inline] failed", {
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

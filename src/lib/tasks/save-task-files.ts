import { randomUUID } from "node:crypto";
import type { OutlineScaffold } from "@/src/lib/ai/prompts/generate-outline";
import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import { createTaskStoragePath } from "@/src/lib/storage/upload";
import { readTaskArtifact, saveTaskArtifact } from "@/src/lib/storage/task-artifacts";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { assertStatusTransition } from "@/src/lib/tasks/status-machine";
import { saveOutlineVersion } from "@/src/lib/tasks/save-outline-version";
import {
  getTaskSummary,
  listTaskFiles,
  patchTaskSummary,
  replaceTaskFiles,
  saveTaskFileRecords
} from "@/src/lib/tasks/repository";
import type {
  TaskAnalysisSnapshot,
  TaskFileRecord,
  TaskStatus,
  TaskSummary
} from "@/src/types/tasks";

type SaveTaskFilesInput = {
  taskId: string;
  userId: string;
  files: Array<{
    originalFilename: string;
    contentType?: string;
    body?: Buffer;
    extractedText: string;
    extractionMethod?: string;
    extractionWarnings?: string[];
    openaiFileId?: string | null;
    openaiUploadStatus?: "pending" | "uploaded" | "failed";
  }>;
};

type DerivedRuleCard = {
  topic: string | null;
  targetWordCount: number;
  citationStyle: string;
  chapterCountOverride: number | null;
  mustAnswer: string[];
  gradingPriorities: string[];
  specialRequirements: string;
};

type PersistedTaskFilesResult = {
  task: TaskSummary;
  files: TaskFileRecord[];
  analysis: TaskAnalysisSnapshot | null;
  ruleCard: DerivedRuleCard | null;
  outline: OutlineScaffold | null;
};

export async function getOwnedTaskSummary(taskId: string, userId: string) {
  if (!shouldUseSupabasePersistence()) {
    const task = getTaskSummary(taskId);

    if (!task || task.userId !== userId) {
      return null;
    }

    return task;
  }

  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("writing_tasks")
    .select(
      "id,status,target_word_count,citation_style,special_requirements,primary_requirement_file_id,topic,requested_chapter_count,outline_revision_count,latest_outline_version_id,analysis_snapshot,analysis_status,analysis_model,analysis_trigger_run_id,analysis_requested_at,analysis_started_at,analysis_completed_at"
    )
    .eq("id", taskId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`读取任务失败：${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    id: String(data.id),
    userId,
    status: data.status,
    targetWordCount:
      typeof data.target_word_count === "number"
        ? Number(data.target_word_count)
        : null,
    citationStyle: data.citation_style ? String(data.citation_style) : null,
    specialRequirements: String(data.special_requirements ?? ""),
    topic: data.topic ? String(data.topic) : undefined,
    requestedChapterCount:
      typeof data.requested_chapter_count === "number"
        ? Number(data.requested_chapter_count)
        : null,
    outlineRevisionCount: Number(data.outline_revision_count ?? 0),
    primaryRequirementFileId: data.primary_requirement_file_id
      ? String(data.primary_requirement_file_id)
      : null,
    latestOutlineVersionId: data.latest_outline_version_id
      ? String(data.latest_outline_version_id)
      : null,
    analysisSnapshot:
      data.analysis_snapshot && typeof data.analysis_snapshot === "object"
        ? (data.analysis_snapshot as TaskAnalysisSnapshot)
        : null,
    analysisStatus:
      data.analysis_status === "succeeded" || data.analysis_status === "failed"
        ? data.analysis_status
        : "pending",
    analysisModel: data.analysis_model ? String(data.analysis_model) : null,
    analysisTriggerRunId: data.analysis_trigger_run_id
      ? String(data.analysis_trigger_run_id)
      : null,
    analysisRequestedAt: data.analysis_requested_at
      ? String(data.analysis_requested_at)
      : null,
    analysisStartedAt: data.analysis_started_at
      ? String(data.analysis_started_at)
      : null,
    analysisCompletedAt: data.analysis_completed_at
      ? String(data.analysis_completed_at)
      : null
  } satisfies TaskSummary;
}

export async function saveTaskFiles(input: SaveTaskFilesInput) {
  return shouldUseSupabasePersistence()
    ? saveTaskFilesWithSupabase(input)
    : saveTaskFilesLocally(input);
}

export async function updateTaskFileOpenAIMetadata(input: {
  taskId: string;
  userId: string;
  files: Array<{
    id: string;
    openaiFileId?: string | null;
    openaiUploadStatus: "pending" | "uploaded" | "failed";
    extractionMethod?: string;
    extractionWarnings?: string[];
  }>;
}) {
  return shouldUseSupabasePersistence()
    ? updateTaskFileOpenAIMetadataWithSupabase(input)
    : updateTaskFileOpenAIMetadataLocally(input);
}

export async function listTaskFilesForModel(
  taskId: string,
  userId: string
): Promise<Array<TaskFileRecord & { rawBody: Buffer | null }>> {
  const files = shouldUseSupabasePersistence()
    ? await listTaskFilesWithSupabase(taskId, userId)
    : listTaskFiles(taskId);

  const withBodies = await Promise.all(
    files.map(async (file) => ({
      ...file,
      rawBody: await readTaskArtifact({
        storagePath: file.storagePath
      }).catch(() => null)
    }))
  );

  return withBodies;
}

export async function listTaskFilesForWorkflow(
  taskId: string,
  userId: string
): Promise<TaskFileRecord[]> {
  return shouldUseSupabasePersistence()
    ? listTaskFilesWithSupabase(taskId, userId)
    : listTaskFiles(taskId).filter((file) => file.userId === userId);
}

export async function persistTaskModelAnalysis(input: {
  taskId: string;
  userId: string;
  analysis: TaskAnalysisSnapshot;
  outline: OutlineScaffold | null;
}): Promise<PersistedTaskFilesResult> {
  return shouldUseSupabasePersistence()
    ? persistTaskModelAnalysisWithSupabase(input)
    : persistTaskModelAnalysisLocally(input);
}

export async function markTaskAnalysisFailed(input: {
  taskId: string;
  userId: string;
  reason: string;
}) {
  return shouldUseSupabasePersistence()
    ? markTaskAnalysisFailedWithSupabase(input)
    : markTaskAnalysisFailedLocally(input);
}

export async function markTaskAnalysisPending(input: {
  taskId: string;
  userId: string;
  primaryRequirementFileId?: string | null;
  triggerRunId?: string | null;
  analysisModel?: string | null;
}) {
  return shouldUseSupabasePersistence()
    ? markTaskAnalysisPendingWithSupabase(input)
    : markTaskAnalysisPendingLocally(input);
}

export async function markTaskAnalysisStarted(input: {
  taskId: string;
  userId: string;
}) {
  return shouldUseSupabasePersistence()
    ? markTaskAnalysisStartedWithSupabase(input)
    : markTaskAnalysisStartedLocally(input);
}

async function saveTaskFilesLocally({
  taskId,
  userId,
  files
}: SaveTaskFilesInput) {
  const records = [];

  for (const file of files) {
    const storagePath = createTaskStoragePath(userId, taskId, file.originalFilename);

    if (file.body) {
      await saveTaskArtifact({
        storagePath,
        body: file.body,
        contentType: file.contentType || "application/octet-stream"
      });
    }

    records.push({
      id: randomUUID(),
      taskId,
      userId,
      originalFilename: file.originalFilename,
      storagePath,
      contentType: file.contentType,
      extractedText: file.extractedText,
      extractionMethod: file.extractionMethod,
      extractionWarnings: file.extractionWarnings ?? [],
      openaiFileId: file.openaiFileId ?? null,
      openaiUploadStatus: file.openaiUploadStatus ?? "pending",
      role: "unknown" as const,
      isPrimary: false
    });
  }

  return saveTaskFileRecords(records);
}

async function saveTaskFilesWithSupabase({
  taskId,
  userId,
  files
}: SaveTaskFilesInput) {
  const client = createSupabaseAdminClient();
  const rows = [];

  for (const file of files) {
    const storagePath = createTaskStoragePath(userId, taskId, file.originalFilename);

    if (file.body) {
      await saveTaskArtifact({
        storagePath,
        body: file.body,
        contentType: file.contentType || "application/octet-stream"
      });
    }

    rows.push({
      task_id: taskId,
      user_id: userId,
      original_filename: file.originalFilename,
      storage_path: storagePath,
      content_type: file.contentType ?? null,
      extracted_text: file.extractedText,
      extraction_method: file.extractionMethod ?? null,
      extraction_warnings: file.extractionWarnings ?? [],
      openai_file_id: file.openaiFileId ?? null,
      openai_upload_status: file.openaiUploadStatus ?? "pending",
      role: "unknown" as const,
      is_primary: false
    });
  }

  const { data, error } = await client
    .from("task_files")
    .insert(rows)
    .select(
      "id,task_id,user_id,original_filename,storage_path,content_type,extracted_text,extraction_method,extraction_warnings,openai_file_id,openai_upload_status,role,is_primary,created_at,updated_at"
    );

  if (error || !data) {
    throw new Error(`保存上传文件失败：${error?.message ?? "数据库没有返回文件"}`);
  }

  return data.map(mapTaskFileRow);
}

async function updateTaskFileOpenAIMetadataLocally(input: {
  taskId: string;
  userId: string;
  files: Array<{
    id: string;
    openaiFileId?: string | null;
    openaiUploadStatus: "pending" | "uploaded" | "failed";
    extractionMethod?: string;
    extractionWarnings?: string[];
  }>;
}) {
  const existingFiles = listTaskFiles(input.taskId);
  const nextFiles = existingFiles.map((file) => {
    const update = input.files.find((candidate) => candidate.id === file.id);
    if (!update) {
      return file;
    }

    return {
      ...file,
      openaiFileId: update.openaiFileId ?? file.openaiFileId ?? null,
      openaiUploadStatus: update.openaiUploadStatus,
      extractionMethod: update.extractionMethod ?? file.extractionMethod,
      extractionWarnings: update.extractionWarnings ?? file.extractionWarnings ?? [],
      updatedAt: new Date().toISOString()
    };
  });

  replaceTaskFiles(input.taskId, nextFiles);
  return nextFiles;
}

async function updateTaskFileOpenAIMetadataWithSupabase(input: {
  taskId: string;
  userId: string;
  files: Array<{
    id: string;
    openaiFileId?: string | null;
    openaiUploadStatus: "pending" | "uploaded" | "failed";
    extractionMethod?: string;
    extractionWarnings?: string[];
  }>;
}) {
  const client = createSupabaseAdminClient();

  for (const file of input.files) {
    const { error } = await client
      .from("task_files")
      .update({
        openai_file_id: file.openaiFileId ?? null,
        openai_upload_status: file.openaiUploadStatus,
        extraction_method: file.extractionMethod ?? null,
        extraction_warnings: file.extractionWarnings ?? []
      })
      .eq("id", file.id)
      .eq("task_id", input.taskId)
      .eq("user_id", input.userId);

    if (error) {
      throw new Error(`更新 OpenAI 文件元数据失败：${error.message}`);
    }
  }

  return listTaskFilesWithSupabase(input.taskId, input.userId);
}

async function persistTaskModelAnalysisLocally(input: {
  taskId: string;
  userId: string;
  analysis: TaskAnalysisSnapshot;
  outline: OutlineScaffold | null;
}): Promise<PersistedTaskFilesResult> {
  const task = getTaskSummary(input.taskId);

  if (!task || task.userId !== input.userId) {
    throw new Error("TASK_NOT_FOUND");
  }

  const currentFiles = listTaskFiles(input.taskId);
  const resolvedTopic = input.analysis.topic ?? input.outline?.articleTitle ?? null;
  const nextStatus: TaskStatus = input.analysis.needsUserConfirmation
    ? "awaiting_primary_file_confirmation"
    : "awaiting_outline_approval";
  assertStatusTransition(task.status, nextStatus);
  const nextFiles = currentFiles.map((file) => {
    const role = resolveRoleFromAnalysis(file.id, input.analysis);
    return {
      ...file,
      role,
      isPrimary: file.id === input.analysis.chosenTaskFileId,
      updatedAt: new Date().toISOString()
    };
  });

  replaceTaskFiles(input.taskId, nextFiles);

  let latestOutlineVersionId = task.latestOutlineVersionId ?? null;
  if (!input.analysis.needsUserConfirmation && input.outline) {
    const savedOutlineVersion = await saveOutlineVersion({
      task: {
        ...task,
        topic: resolvedTopic,
        targetWordCount: input.analysis.targetWordCount,
        citationStyle: input.analysis.citationStyle,
        requestedChapterCount: input.analysis.chapterCount
      },
      userId: input.userId,
      outline: input.outline
    });
    latestOutlineVersionId = savedOutlineVersion.id;
  }

  const nextTask = patchTaskSummary(input.taskId, {
    status: nextStatus,
    primaryRequirementFileId: input.analysis.chosenTaskFileId,
    targetWordCount: input.analysis.needsUserConfirmation
      ? task.targetWordCount
      : input.analysis.targetWordCount,
    citationStyle: input.analysis.needsUserConfirmation
      ? task.citationStyle
      : input.analysis.citationStyle,
    topic: input.analysis.needsUserConfirmation ? task.topic : resolvedTopic,
    requestedChapterCount: input.analysis.chapterCount,
    latestOutlineVersionId,
    analysisSnapshot: input.analysis,
    analysisStatus: "succeeded",
    analysisModel: "gpt-5.2",
    analysisStartedAt: task.analysisStartedAt ?? new Date().toISOString(),
    analysisCompletedAt: new Date().toISOString()
  });

  if (!nextTask) {
    throw new Error("TASK_NOT_FOUND");
  }

  return {
    task: nextTask,
    files: nextFiles,
    analysis: input.analysis,
    ruleCard: input.analysis.needsUserConfirmation
      ? null
      : buildRuleCardFromAnalysis(input.analysis, input.outline),
    outline: input.outline
  };
}

async function persistTaskModelAnalysisWithSupabase(input: {
  taskId: string;
  userId: string;
  analysis: TaskAnalysisSnapshot;
  outline: OutlineScaffold | null;
}): Promise<PersistedTaskFilesResult> {
  const client = createSupabaseAdminClient();
  const ownedTask = await getOwnedTaskSummary(input.taskId, input.userId);

  if (!ownedTask) {
    throw new Error("TASK_NOT_FOUND");
  }

  const files = await listTaskFilesWithSupabase(input.taskId, input.userId);
  const resolvedTopic = input.analysis.topic ?? input.outline?.articleTitle ?? null;

  for (const file of files) {
    const { error } = await client
      .from("task_files")
      .update({
        role: resolveRoleFromAnalysis(file.id, input.analysis),
        is_primary: file.id === input.analysis.chosenTaskFileId
      })
      .eq("id", file.id)
      .eq("task_id", input.taskId)
      .eq("user_id", input.userId);

    if (error) {
      throw new Error(`更新文件分析结果失败：${error.message}`);
    }
  }

  const nextStatus: TaskStatus = input.analysis.needsUserConfirmation
    ? "awaiting_primary_file_confirmation"
    : "awaiting_outline_approval";
  assertStatusTransition(ownedTask.status, nextStatus);

  let latestOutlineVersionId = ownedTask.latestOutlineVersionId ?? null;
  if (!input.analysis.needsUserConfirmation && input.outline) {
    const savedOutlineVersion = await saveOutlineVersion({
      task: {
        ...ownedTask,
        topic: resolvedTopic,
        targetWordCount: input.analysis.targetWordCount,
        citationStyle: input.analysis.citationStyle,
        requestedChapterCount: input.analysis.chapterCount
      },
      userId: input.userId,
      outline: input.outline
    });
    latestOutlineVersionId = savedOutlineVersion.id;
  }

  const { error: taskError } = await client
    .from("writing_tasks")
    .update({
      status: nextStatus,
      primary_requirement_file_id: input.analysis.chosenTaskFileId,
      target_word_count: input.analysis.needsUserConfirmation
        ? ownedTask.targetWordCount
        : input.analysis.targetWordCount,
      citation_style: input.analysis.needsUserConfirmation
        ? ownedTask.citationStyle
        : input.analysis.citationStyle,
      topic: input.analysis.needsUserConfirmation ? ownedTask.topic : resolvedTopic,
      requested_chapter_count: input.analysis.chapterCount,
      latest_outline_version_id: latestOutlineVersionId,
      analysis_snapshot: input.analysis,
      analysis_status: "succeeded",
      analysis_model: "gpt-5.2",
      analysis_started_at: ownedTask.analysisStartedAt ?? new Date().toISOString(),
      analysis_completed_at: new Date().toISOString()
    })
    .eq("id", input.taskId)
    .eq("user_id", input.userId);

  if (taskError) {
    throw new Error(`保存分析结果失败：${taskError.message}`);
  }

  return {
    task: {
      ...ownedTask,
      status: nextStatus,
      primaryRequirementFileId: input.analysis.chosenTaskFileId,
      targetWordCount: input.analysis.needsUserConfirmation
        ? ownedTask.targetWordCount
        : input.analysis.targetWordCount,
      citationStyle: input.analysis.needsUserConfirmation
        ? ownedTask.citationStyle
        : input.analysis.citationStyle,
      topic: input.analysis.needsUserConfirmation ? ownedTask.topic : resolvedTopic,
      requestedChapterCount: input.analysis.chapterCount,
      latestOutlineVersionId,
      analysisSnapshot: input.analysis,
      analysisStatus: "succeeded",
      analysisModel: "gpt-5.2",
      analysisStartedAt: ownedTask.analysisStartedAt ?? new Date().toISOString(),
      analysisCompletedAt: new Date().toISOString()
    },
    files: await listTaskFilesWithSupabase(input.taskId, input.userId),
    analysis: input.analysis,
    ruleCard: input.analysis.needsUserConfirmation
      ? null
      : buildRuleCardFromAnalysis(input.analysis, input.outline),
    outline: input.outline
  };
}

async function listTaskFilesWithSupabase(taskId: string, userId: string) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("task_files")
    .select(
      "id,task_id,user_id,original_filename,storage_path,content_type,extracted_text,extraction_method,extraction_warnings,openai_file_id,openai_upload_status,role,is_primary,created_at,updated_at"
    )
    .eq("task_id", taskId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    throw new Error(`读取任务文件失败：${error?.message ?? "数据库没有返回文件"}`);
  }

  return data.map(mapTaskFileRow);
}

function mapTaskFileRow(row: {
  id: string;
  task_id: string;
  user_id: string;
  original_filename: string;
  storage_path: string;
  content_type?: string | null;
  extracted_text: string;
  extraction_method?: string | null;
  extraction_warnings?: string[] | null;
  openai_file_id?: string | null;
  openai_upload_status?: "pending" | "uploaded" | "failed" | null;
  role: TaskFileRecord["role"];
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}) {
  return {
    id: String(row.id),
    taskId: String(row.task_id),
    userId: String(row.user_id),
    originalFilename: String(row.original_filename),
    storagePath: String(row.storage_path),
    contentType: row.content_type ? String(row.content_type) : undefined,
    extractedText: String(row.extracted_text ?? ""),
    extractionMethod: row.extraction_method ? String(row.extraction_method) : undefined,
    extractionWarnings: Array.isArray(row.extraction_warnings)
      ? row.extraction_warnings.map(String)
      : [],
    openaiFileId: row.openai_file_id ? String(row.openai_file_id) : null,
    openaiUploadStatus: row.openai_upload_status ?? "pending",
    role: row.role,
    isPrimary: Boolean(row.is_primary),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  } satisfies TaskFileRecord;
}

function resolveRoleFromAnalysis(
  fileId: string,
  analysis: TaskAnalysisSnapshot
): TaskFileRecord["role"] {
  if (fileId === analysis.chosenTaskFileId) {
    return "requirement";
  }

  if (analysis.supportingFileIds.includes(fileId)) {
    return "background";
  }

  if (analysis.ignoredFileIds.includes(fileId)) {
    return "irrelevant";
  }

  return "unknown";
}

function buildRuleCardFromAnalysis(
  analysis: TaskAnalysisSnapshot,
  outline: OutlineScaffold | null
) {
  return {
    topic: analysis.topic ?? outline?.articleTitle ?? null,
    targetWordCount: analysis.targetWordCount,
    citationStyle: analysis.citationStyle,
    chapterCountOverride: analysis.chapterCount,
    mustAnswer: analysis.mustCover,
    gradingPriorities: analysis.gradingFocus,
    specialRequirements: analysis.appliedSpecialRequirements
  };
}

async function markTaskAnalysisFailedLocally(input: {
  taskId: string;
  userId: string;
  reason: string;
}) {
  const task = getTaskSummary(input.taskId);
  if (!task || task.userId !== input.userId) {
    return null;
  }

  const now = new Date().toISOString();
  return patchTaskSummary(input.taskId, {
    analysisStatus: "failed",
    analysisModel: "gpt-5.2",
    analysisCompletedAt: now,
    analysisStartedAt: task.analysisStartedAt ?? now,
    analysisSnapshot: task.analysisSnapshot
      ? {
          ...task.analysisSnapshot,
          warnings: [
            ...(task.analysisSnapshot.warnings ?? []),
            `analysis_failed:${input.reason}`
          ]
        }
      : null
  });
}

async function markTaskAnalysisFailedWithSupabase(input: {
  taskId: string;
  userId: string;
  reason: string;
}) {
  const client = createSupabaseAdminClient();
  const ownedTask = await getOwnedTaskSummary(input.taskId, input.userId);
  const existingSnapshot = ownedTask?.analysisSnapshot ?? null;
  const existingWarnings = Array.isArray(existingSnapshot?.warnings)
    ? existingSnapshot.warnings
    : [];
  const nextSnapshot = existingSnapshot
    ? {
        ...existingSnapshot,
        warnings: [...existingWarnings, `analysis_failed:${input.reason}`]
      }
    : null;
  const now = new Date().toISOString();
  const { error } = await client
    .from("writing_tasks")
    .update({
      analysis_status: "failed",
      analysis_model: "gpt-5.2",
      analysis_started_at: ownedTask?.analysisStartedAt ?? now,
      analysis_completed_at: now,
      analysis_snapshot: nextSnapshot
    })
    .eq("id", input.taskId)
    .eq("user_id", input.userId);

  if (error) {
    throw new Error(`写入分析失败状态失败：${error.message}`);
  }
}

async function markTaskAnalysisPendingLocally(input: {
  taskId: string;
  userId: string;
  primaryRequirementFileId?: string | null;
  triggerRunId?: string | null;
  analysisModel?: string | null;
}) {
  const task = getTaskSummary(input.taskId);
  if (!task || task.userId !== input.userId) {
    return null;
  }

  return patchTaskSummary(input.taskId, {
    analysisStatus: "pending",
    analysisModel: input.analysisModel ?? null,
    analysisTriggerRunId: input.triggerRunId ?? null,
    analysisRequestedAt: new Date().toISOString(),
    analysisStartedAt: null,
    analysisCompletedAt: null,
    analysisSnapshot: null,
    ...(input.primaryRequirementFileId !== undefined
      ? {
          primaryRequirementFileId: input.primaryRequirementFileId
        }
      : {})
  });
}

async function markTaskAnalysisPendingWithSupabase(input: {
  taskId: string;
  userId: string;
  primaryRequirementFileId?: string | null;
  triggerRunId?: string | null;
  analysisModel?: string | null;
}) {
  const client = createSupabaseAdminClient();
  const patch: Record<string, unknown> = {
    analysis_status: "pending",
    analysis_model: input.analysisModel ?? null,
    analysis_trigger_run_id: input.triggerRunId ?? null,
    analysis_requested_at: new Date().toISOString(),
    analysis_started_at: null,
    analysis_completed_at: null,
    analysis_snapshot: null
  };

  if (input.primaryRequirementFileId !== undefined) {
    patch.primary_requirement_file_id = input.primaryRequirementFileId;
  }

  const { error } = await client
    .from("writing_tasks")
    .update(patch)
    .eq("id", input.taskId)
    .eq("user_id", input.userId);

  if (error) {
    throw new Error(`写入分析中状态失败：${error.message}`);
  }
}

async function markTaskAnalysisStartedLocally(input: {
  taskId: string;
  userId: string;
}) {
  const task = getTaskSummary(input.taskId);
  if (!task || task.userId !== input.userId) {
    return null;
  }

  const now = new Date().toISOString();
  return patchTaskSummary(input.taskId, {
    analysisStartedAt: now
  });
}

async function markTaskAnalysisStartedWithSupabase(input: {
  taskId: string;
  userId: string;
}) {
  const client = createSupabaseAdminClient();
  const { error } = await client
    .from("writing_tasks")
    .update({
      analysis_started_at: new Date().toISOString()
    })
    .eq("id", input.taskId)
    .eq("user_id", input.userId);

  if (error) {
    throw new Error(`写入分析启动时间失败：${error.message}`);
  }
}

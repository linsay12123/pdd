import { randomUUID } from "node:crypto";
import type { FileClassificationResult } from "@/src/lib/ai/services/classify-files";
import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import { createTaskStoragePath } from "@/src/lib/storage/upload";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { buildTaskOutlineBundle, type TaskOutlineBundle } from "@/src/lib/tasks/build-task-outline";
import { saveOutlineVersion } from "@/src/lib/tasks/save-outline-version";
import {
  getTaskSummary,
  listTaskFiles,
  patchTaskSummary,
  replaceTaskFiles,
  saveTaskFileRecords,
  updateTaskStatus
} from "@/src/lib/tasks/repository";
import type { TaskFileRecord, TaskStatus, TaskSummary } from "@/src/types/tasks";

type SaveTaskFilesInput = {
  taskId: string;
  userId: string;
  files: Array<{
    originalFilename: string;
    extractedText: string;
  }>;
};

type ConfirmPrimaryTaskFileInput = {
  taskId: string;
  userId: string;
  fileId: string;
};

type ApplyFileClassificationInput = {
  taskId: string;
  userId: string;
  classification: FileClassificationResult;
};

type PersistedTaskFilesResult = {
  task: TaskSummary;
  files: TaskFileRecord[];
  ruleCard: TaskOutlineBundle["ruleCard"] | null;
  outline: TaskOutlineBundle["outline"] | null;
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
      "id,status,target_word_count,citation_style,special_requirements,primary_requirement_file_id"
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
    targetWordCount: Number(data.target_word_count),
    citationStyle: String(data.citation_style),
    specialRequirements: String(data.special_requirements ?? ""),
    primaryRequirementFileId: data.primary_requirement_file_id
      ? String(data.primary_requirement_file_id)
      : null
  } satisfies TaskSummary;
}

export async function saveTaskFiles(input: SaveTaskFilesInput) {
  return shouldUseSupabasePersistence()
    ? saveTaskFilesWithSupabase(input)
    : saveTaskFilesLocally(input);
}

export async function applyFileClassification(
  input: ApplyFileClassificationInput
): Promise<PersistedTaskFilesResult> {
  return shouldUseSupabasePersistence()
    ? applyFileClassificationWithSupabase(input)
    : applyFileClassificationLocally(input);
}

export async function confirmPrimaryTaskFile(
  input: ConfirmPrimaryTaskFileInput
): Promise<PersistedTaskFilesResult> {
  return shouldUseSupabasePersistence()
    ? confirmPrimaryTaskFileWithSupabase(input)
    : confirmPrimaryTaskFileLocally(input);
}

async function saveTaskFilesLocally({
  taskId,
  userId,
  files
}: SaveTaskFilesInput) {
  return saveTaskFileRecords(
    files.map((file) => ({
      id: randomUUID(),
      taskId,
      userId,
      originalFilename: file.originalFilename,
      storagePath: createTaskStoragePath(userId, taskId, file.originalFilename),
      extractedText: file.extractedText,
      role: "unknown",
      isPrimary: false
    }))
  );
}

async function saveTaskFilesWithSupabase({
  taskId,
  userId,
  files
}: SaveTaskFilesInput) {
  const client = createSupabaseAdminClient();
  const rows = files.map((file) => ({
    task_id: taskId,
    user_id: userId,
    original_filename: file.originalFilename,
    storage_path: createTaskStoragePath(userId, taskId, file.originalFilename),
    extracted_text: file.extractedText,
    role: "unknown" as const,
    is_primary: false
  }));
  const { data, error } = await client
    .from("task_files")
    .insert(rows)
    .select(
      "id,task_id,user_id,original_filename,storage_path,extracted_text,role,is_primary,created_at,updated_at"
    );

  if (error || !data) {
    throw new Error(`保存上传文件失败：${error?.message ?? "数据库没有返回文件"}`);
  }

  return data.map(mapTaskFileRow);
}

async function applyFileClassificationLocally({
  taskId,
  userId,
  classification
}: ApplyFileClassificationInput): Promise<PersistedTaskFilesResult> {
  const task = getTaskSummary(taskId);

  if (!task) {
    throw new Error("TASK_NOT_FOUND");
  }

  const files = listTaskFiles(taskId);
  const nextStatus: TaskStatus = classification.needsUserConfirmation
    ? "awaiting_primary_file_confirmation"
    : "building_rule_card";
  const nextFiles = files.map((file) => {
    const role = resolveRoleForFile(file.id, classification);
    const isPrimary = file.id === classification.primaryRequirementFileId;

    return {
      ...file,
      role,
      isPrimary,
      updatedAt: new Date().toISOString()
    };
  });

  replaceTaskFiles(taskId, nextFiles);
  updateTaskStatus(taskId, nextStatus);
  const nextTask = patchTaskSummary(taskId, {
    primaryRequirementFileId: classification.primaryRequirementFileId,
    status: nextStatus
  });

  if (!nextTask) {
    throw new Error("TASK_NOT_FOUND");
  }

  if (!classification.primaryRequirementFileId) {
    return {
      task: nextTask,
      files: nextFiles,
      ruleCard: null,
      outline: null
    };
  }

  const outlineBundle = await buildTaskOutlineBundle({
    task: nextTask,
    files: nextFiles,
    primaryRequirementFileId: classification.primaryRequirementFileId
  });
  const savedOutlineVersion = await saveOutlineVersion({
    task: {
      ...nextTask,
      topic: outlineBundle.ruleCard.topic
    },
    userId,
    outline: outlineBundle.outline
  });
  const outlinedTask = patchTaskSummary(taskId, {
    status: "awaiting_outline_approval",
    topic: outlineBundle.ruleCard.topic,
    requestedChapterCount: outlineBundle.ruleCard.chapterCountOverride,
    targetWordCount: outlineBundle.ruleCard.targetWordCount,
    citationStyle: outlineBundle.ruleCard.citationStyle,
    latestOutlineVersionId: savedOutlineVersion.id
  });

  if (!outlinedTask) {
    throw new Error("TASK_NOT_FOUND");
  }

  return {
    task: outlinedTask,
    files: nextFiles,
    ruleCard: outlineBundle.ruleCard,
    outline: outlineBundle.outline
  };
}

async function applyFileClassificationWithSupabase({
  taskId,
  userId,
  classification
}: ApplyFileClassificationInput): Promise<PersistedTaskFilesResult> {
  const client = createSupabaseAdminClient();
  const ownedTask = await getOwnedTaskSummary(taskId, userId);

  if (!ownedTask) {
    throw new Error("TASK_NOT_FOUND");
  }

  const nextStatus: TaskStatus = classification.needsUserConfirmation
    ? "awaiting_primary_file_confirmation"
    : "building_rule_card";

  const { error: resetError } = await client
    .from("task_files")
    .update({
      role: "unknown",
      is_primary: false
    })
    .eq("task_id", taskId)
    .eq("user_id", userId);

  if (resetError) {
    throw new Error(`更新文件分类失败：${resetError.message}`);
  }

  if (classification.backgroundFileIds.length > 0) {
    const { error } = await client
      .from("task_files")
      .update({
        role: "background"
      })
      .in("id", classification.backgroundFileIds)
      .eq("task_id", taskId)
      .eq("user_id", userId);

    if (error) {
      throw new Error(`更新背景文件失败：${error.message}`);
    }
  }

  if (classification.irrelevantFileIds.length > 0) {
    const { error } = await client
      .from("task_files")
      .update({
        role: "irrelevant"
      })
      .in("id", classification.irrelevantFileIds)
      .eq("task_id", taskId)
      .eq("user_id", userId);

    if (error) {
      throw new Error(`更新无关文件失败：${error.message}`);
    }
  }

  if (classification.primaryRequirementFileId) {
    const { error } = await client
      .from("task_files")
      .update({
        role: "requirement",
        is_primary: true
      })
      .eq("id", classification.primaryRequirementFileId)
      .eq("task_id", taskId)
      .eq("user_id", userId);

    if (error) {
      throw new Error(`更新任务书失败：${error.message}`);
    }
  }

  const { error: taskError } = await client
    .from("writing_tasks")
    .update({
      status: nextStatus,
      primary_requirement_file_id: classification.primaryRequirementFileId
    })
    .eq("id", taskId)
    .eq("user_id", userId);

  if (taskError) {
    throw new Error(`更新任务状态失败：${taskError.message}`);
  }

  if (!classification.primaryRequirementFileId) {
    return {
      task: {
        ...ownedTask,
        status: nextStatus,
        primaryRequirementFileId: classification.primaryRequirementFileId
      },
      files: await listTaskFilesWithSupabase(taskId, userId),
      ruleCard: null,
      outline: null
    };
  }

  const files = await listTaskFilesWithSupabase(taskId, userId);
  const outlineBundle = await buildTaskOutlineBundle({
    task: {
      ...ownedTask,
      status: nextStatus,
      primaryRequirementFileId: classification.primaryRequirementFileId
    },
    files,
    primaryRequirementFileId: classification.primaryRequirementFileId
  });
  const savedOutlineVersion = await saveOutlineVersion({
    task: {
      ...ownedTask,
      status: nextStatus,
      topic: outlineBundle.ruleCard.topic,
      primaryRequirementFileId: classification.primaryRequirementFileId
    },
    userId,
    outline: outlineBundle.outline
  });
  const { error: outlinedTaskError } = await client
    .from("writing_tasks")
    .update({
      status: "awaiting_outline_approval",
      target_word_count: outlineBundle.ruleCard.targetWordCount,
      citation_style: outlineBundle.ruleCard.citationStyle,
      topic: outlineBundle.ruleCard.topic,
      requested_chapter_count: outlineBundle.ruleCard.chapterCountOverride,
      latest_outline_version_id: savedOutlineVersion.id
    })
    .eq("id", taskId)
    .eq("user_id", userId);

  if (outlinedTaskError) {
    throw new Error(`更新写作规则失败：${outlinedTaskError.message}`);
  }

  return {
    task: {
      ...ownedTask,
      status: "awaiting_outline_approval",
      targetWordCount: outlineBundle.ruleCard.targetWordCount,
      citationStyle: outlineBundle.ruleCard.citationStyle,
      topic: outlineBundle.ruleCard.topic,
      requestedChapterCount: outlineBundle.ruleCard.chapterCountOverride,
      primaryRequirementFileId: classification.primaryRequirementFileId
    },
    files,
    ruleCard: outlineBundle.ruleCard,
    outline: outlineBundle.outline
  };
}

async function confirmPrimaryTaskFileLocally({
  taskId,
  userId,
  fileId
}: ConfirmPrimaryTaskFileInput): Promise<PersistedTaskFilesResult> {
  const task = getTaskSummary(taskId);

  if (!task || task.userId !== userId) {
    throw new Error("TASK_NOT_FOUND");
  }

  const files = listTaskFiles(taskId);
  const selectedFile = files.find((file) => file.id === fileId && file.userId === userId);

  if (!selectedFile) {
    throw new Error("FILE_NOT_FOUND");
  }

  const nextFiles = files.map((file) => ({
    ...file,
    role: file.id === fileId ? "requirement" : file.role,
    isPrimary: file.id === fileId,
    updatedAt: new Date().toISOString()
  }));

  replaceTaskFiles(taskId, nextFiles);
  updateTaskStatus(taskId, "building_rule_card");
  const nextTask = patchTaskSummary(taskId, {
    primaryRequirementFileId: fileId,
    status: "building_rule_card"
  });

  if (!nextTask) {
    throw new Error("TASK_NOT_FOUND");
  }

  const outlineBundle = await buildTaskOutlineBundle({
    task: nextTask,
    files: nextFiles,
    primaryRequirementFileId: fileId
  });
  const savedOutlineVersion = await saveOutlineVersion({
    task: {
      ...nextTask,
      topic: outlineBundle.ruleCard.topic
    },
    userId,
    outline: outlineBundle.outline
  });
  const outlinedTask = patchTaskSummary(taskId, {
    status: "awaiting_outline_approval",
    topic: outlineBundle.ruleCard.topic,
    requestedChapterCount: outlineBundle.ruleCard.chapterCountOverride,
    targetWordCount: outlineBundle.ruleCard.targetWordCount,
    citationStyle: outlineBundle.ruleCard.citationStyle,
    latestOutlineVersionId: savedOutlineVersion.id
  });

  if (!outlinedTask) {
    throw new Error("TASK_NOT_FOUND");
  }

  return {
    task: outlinedTask,
    files: nextFiles,
    ruleCard: outlineBundle.ruleCard,
    outline: outlineBundle.outline
  };
}

async function confirmPrimaryTaskFileWithSupabase({
  taskId,
  userId,
  fileId
}: ConfirmPrimaryTaskFileInput): Promise<PersistedTaskFilesResult> {
  const client = createSupabaseAdminClient();
  const ownedTask = await getOwnedTaskSummary(taskId, userId);

  if (!ownedTask) {
    throw new Error("TASK_NOT_FOUND");
  }

  const { data: targetFile, error: targetFileError } = await client
    .from("task_files")
    .select("id")
    .eq("id", fileId)
    .eq("task_id", taskId)
    .eq("user_id", userId)
    .maybeSingle();

  if (targetFileError) {
    throw new Error(`读取任务文件失败：${targetFileError.message}`);
  }

  if (!targetFile) {
    throw new Error("FILE_NOT_FOUND");
  }

  const { error: resetError } = await client
    .from("task_files")
    .update({
      is_primary: false
    })
    .eq("task_id", taskId)
    .eq("user_id", userId);

  if (resetError) {
    throw new Error(`重置主文件失败：${resetError.message}`);
  }

  const { error: fileError } = await client
    .from("task_files")
    .update({
      role: "requirement",
      is_primary: true
    })
    .eq("id", fileId)
    .eq("task_id", taskId)
    .eq("user_id", userId);

  if (fileError) {
    throw new Error(`确认主任务文件失败：${fileError.message}`);
  }

  const { error: taskError } = await client
    .from("writing_tasks")
    .update({
      status: "building_rule_card",
      primary_requirement_file_id: fileId
    })
    .eq("id", taskId)
    .eq("user_id", userId);

  if (taskError) {
    throw new Error(`更新任务状态失败：${taskError.message}`);
  }

  const files = await listTaskFilesWithSupabase(taskId, userId);
  const outlineBundle = await buildTaskOutlineBundle({
    task: {
      ...ownedTask,
      status: "building_rule_card",
      primaryRequirementFileId: fileId
    },
    files,
    primaryRequirementFileId: fileId
  });
  const savedOutlineVersion = await saveOutlineVersion({
    task: {
      ...ownedTask,
      status: "building_rule_card",
      topic: outlineBundle.ruleCard.topic,
      primaryRequirementFileId: fileId
    },
    userId,
    outline: outlineBundle.outline
  });
  const { error: outlinedTaskError } = await client
    .from("writing_tasks")
    .update({
      status: "awaiting_outline_approval",
      target_word_count: outlineBundle.ruleCard.targetWordCount,
      citation_style: outlineBundle.ruleCard.citationStyle,
      topic: outlineBundle.ruleCard.topic,
      requested_chapter_count: outlineBundle.ruleCard.chapterCountOverride,
      latest_outline_version_id: savedOutlineVersion.id
    })
    .eq("id", taskId)
    .eq("user_id", userId);

  if (outlinedTaskError) {
    throw new Error(`更新写作规则失败：${outlinedTaskError.message}`);
  }

  return {
    task: {
      ...ownedTask,
      status: "awaiting_outline_approval",
      targetWordCount: outlineBundle.ruleCard.targetWordCount,
      citationStyle: outlineBundle.ruleCard.citationStyle,
      topic: outlineBundle.ruleCard.topic,
      requestedChapterCount: outlineBundle.ruleCard.chapterCountOverride,
      primaryRequirementFileId: fileId
    },
    files,
    ruleCard: outlineBundle.ruleCard,
    outline: outlineBundle.outline
  };
}

async function listTaskFilesWithSupabase(taskId: string, userId: string) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("task_files")
    .select(
      "id,task_id,user_id,original_filename,storage_path,extracted_text,role,is_primary,created_at,updated_at"
    )
    .eq("task_id", taskId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    throw new Error(`读取任务文件失败：${error?.message ?? "数据库没有返回文件"}`);
  }

  return data.map(mapTaskFileRow);
}

function resolveRoleForFile(
  fileId: string,
  classification: FileClassificationResult
): TaskFileRecord["role"] {
  if (fileId === classification.primaryRequirementFileId) {
    return "requirement";
  }

  if (classification.backgroundFileIds.includes(fileId)) {
    return "background";
  }

  if (classification.irrelevantFileIds.includes(fileId)) {
    return "irrelevant";
  }

  return "unknown";
}

function mapTaskFileRow(row: {
  id: string;
  task_id: string;
  user_id: string;
  original_filename: string;
  storage_path: string;
  extracted_text: string;
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
    extractedText: String(row.extracted_text ?? ""),
    role: row.role,
    isPrimary: Boolean(row.is_primary),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  } satisfies TaskFileRecord;
}

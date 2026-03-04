import { randomUUID } from "node:crypto";
import type { OutlineScaffold } from "@/src/lib/ai/prompts/generate-outline";
import { reviseOutlineFromFilesWithOpenAI } from "@/src/lib/ai/services/revise-outline-from-files";
import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import {
  getTaskOutlineVersion,
  getTaskSummary,
  listTaskOutlineVersions,
  patchTaskSummary,
  replaceTaskOutlineVersions,
  saveTaskSummary,
  saveTaskOutlineVersion
} from "@/src/lib/tasks/repository";
import { listTaskFilesForModel } from "@/src/lib/tasks/save-task-files";
import type { TaskOutlineVersion, TaskSummary } from "@/src/types/tasks";

const MAX_OUTLINE_REVISIONS = 5;

type SaveOutlineVersionInput = {
  task: TaskSummary;
  userId: string;
  outline: OutlineScaffold;
  feedback?: string;
  isApproved?: boolean;
};

type ReviseOutlineInput = {
  taskId: string;
  userId: string;
  feedback: string;
};

type ApproveOutlineInput = {
  taskId: string;
  userId: string;
  outlineVersionId?: string;
};

type OutlineActionResult = {
  task: TaskSummary;
  outlineVersion: TaskOutlineVersion;
};

export async function saveOutlineVersion(
  input: SaveOutlineVersionInput
): Promise<TaskOutlineVersion> {
  return shouldUseSupabasePersistence()
    ? saveOutlineVersionWithSupabase(input)
    : saveOutlineVersionLocally(input);
}

export async function reviseOutlineVersion(
  input: ReviseOutlineInput
): Promise<OutlineActionResult> {
  return shouldUseSupabasePersistence()
    ? reviseOutlineVersionWithSupabase(input)
    : reviseOutlineVersionLocally(input);
}

export async function approveOutlineVersion(
  input: ApproveOutlineInput
): Promise<OutlineActionResult> {
  return shouldUseSupabasePersistence()
    ? approveOutlineVersionWithSupabase(input)
    : approveOutlineVersionLocally(input);
}

async function saveOutlineVersionLocally({
  task,
  userId,
  outline,
  feedback = "",
  isApproved = false
}: SaveOutlineVersionInput) {
  if (!getTaskSummary(task.id)) {
    saveTaskSummary(task);
  }

  const versionNumber = listTaskOutlineVersions(task.id).length + 1;
  const version = saveTaskOutlineVersion({
    id: randomUUID(),
    taskId: task.id,
    userId,
    versionNumber,
    outline,
    feedback,
    isApproved,
    targetWordCount: outline.targetWordCount,
    citationStyle: outline.citationStyle
  });

  patchTaskSummary(task.id, {
    ...task,
    topic: task.topic ?? outline.articleTitle.replace(/:.*$/, ""),
    requestedChapterCount: task.requestedChapterCount ?? outline.sections.length,
    latestOutlineVersionId: version.id,
    targetWordCount: outline.targetWordCount,
    citationStyle: outline.citationStyle,
    outlineRevisionCount: task.outlineRevisionCount ?? 0
  });

  return version;
}

async function saveOutlineVersionWithSupabase({
  task,
  userId,
  outline,
  feedback = "",
  isApproved = false
}: SaveOutlineVersionInput) {
  const client = createSupabaseAdminClient();
  const { data: latestRow, error: latestError } = await client
    .from("outline_versions")
    .select("version_number")
    .eq("task_id", task.id)
    .eq("user_id", userId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    throw new Error(`读取大纲版本失败：${latestError.message}`);
  }

  const versionNumber = Number(latestRow?.version_number ?? 0) + 1;
  const { data, error } = await client
    .from("outline_versions")
    .insert({
      task_id: task.id,
      user_id: userId,
      version_number: versionNumber,
      english_outline: JSON.stringify(outline),
      chinese_outline: null,
      feedback,
      is_approved: isApproved,
      target_word_count: outline.targetWordCount,
      citation_style: outline.citationStyle
    })
    .select(
      "id,task_id,user_id,version_number,english_outline,feedback,is_approved,target_word_count,citation_style,created_at"
    )
    .single();

  if (error || !data) {
    throw new Error(`保存大纲版本失败：${error?.message ?? "数据库没有返回大纲版本"}`);
  }

  const version = mapOutlineVersionRow(data);
  const { error: taskError } = await client
    .from("writing_tasks")
    .update({
      latest_outline_version_id: version.id,
      target_word_count: outline.targetWordCount,
      citation_style: outline.citationStyle,
      topic: task.topic ?? outline.articleTitle.replace(/:.*$/, ""),
      requested_chapter_count: task.requestedChapterCount ?? outline.sections.length,
      outline_revision_count: task.outlineRevisionCount ?? 0
    })
    .eq("id", task.id)
    .eq("user_id", userId);

  if (taskError) {
    throw new Error(`更新任务大纲信息失败：${taskError.message}`);
  }

  return version;
}

async function reviseOutlineVersionLocally({
  taskId,
  userId,
  feedback
}: ReviseOutlineInput): Promise<OutlineActionResult> {
  const task = getOwnedTaskLocally(taskId, userId);
  const previousOutline = task.latestOutlineVersionId
    ? getTaskOutlineVersion(taskId, task.latestOutlineVersionId)?.outline ?? null
    : null;

  if ((task.outlineRevisionCount ?? 0) >= MAX_OUTLINE_REVISIONS) {
    throw new Error("OUTLINE_REVISION_LIMIT_REACHED");
  }

  if (!task.analysisSnapshot) {
    throw new Error("TASK_ANALYSIS_NOT_FOUND");
  }

  const files = await listTaskFilesForModel(taskId, userId);
  const outline = await reviseOutlineFromFilesWithOpenAI({
    files,
    analysis: task.analysisSnapshot,
    previousOutline,
    feedback
  });
  const nextTask = patchTaskSummary(taskId, {
    outlineRevisionCount: (task.outlineRevisionCount ?? 0) + 1,
    latestOutlineVersionId: null
  });

  if (!nextTask) {
    throw new Error("TASK_NOT_FOUND");
  }

  const version = await saveOutlineVersion({
    task: nextTask,
    userId,
    outline,
    feedback
  });

  return {
    task: getTaskSummary(taskId) as TaskSummary,
    outlineVersion: version
  };
}

async function reviseOutlineVersionWithSupabase({
  taskId,
  userId,
  feedback
}: ReviseOutlineInput): Promise<OutlineActionResult> {
  const task = await getOwnedTaskWithSupabase(taskId, userId);
  const previousOutline = task.latestOutlineVersionId
    ? await getTaskOutlineVersionWithSupabase(taskId, userId, task.latestOutlineVersionId)
    : null;

  if ((task.outlineRevisionCount ?? 0) >= MAX_OUTLINE_REVISIONS) {
    throw new Error("OUTLINE_REVISION_LIMIT_REACHED");
  }

  if (!task.analysisSnapshot) {
    throw new Error("TASK_ANALYSIS_NOT_FOUND");
  }

  const files = await listTaskFilesForModel(taskId, userId);
  const outline = await reviseOutlineFromFilesWithOpenAI({
    files,
    analysis: task.analysisSnapshot,
    previousOutline: previousOutline?.outline ?? null,
    feedback
  });
  const updatedTask = {
    ...task,
    outlineRevisionCount: (task.outlineRevisionCount ?? 0) + 1
  };
  const version = await saveOutlineVersion({
    task: updatedTask,
    userId,
    outline,
    feedback
  });
  const client = createSupabaseAdminClient();
  const { error } = await client
    .from("writing_tasks")
    .update({
      status: "awaiting_outline_approval",
      outline_revision_count: updatedTask.outlineRevisionCount,
      latest_outline_version_id: version.id
    })
    .eq("id", taskId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`更新任务大纲版本失败：${error.message}`);
  }

  return {
    task: {
      ...updatedTask,
      status: "awaiting_outline_approval",
      latestOutlineVersionId: version.id
    },
    outlineVersion: version
  };
}

async function approveOutlineVersionLocally({
  taskId,
  userId,
  outlineVersionId
}: ApproveOutlineInput): Promise<OutlineActionResult> {
  const task = getOwnedTaskLocally(taskId, userId);
  const targetVersionId = outlineVersionId ?? task.latestOutlineVersionId;

  if (!targetVersionId) {
    throw new Error("OUTLINE_VERSION_NOT_FOUND");
  }

  const existingVersions = listTaskOutlineVersions(taskId);
  const targetVersion = getTaskOutlineVersion(taskId, targetVersionId);

  if (!targetVersion || targetVersion.userId !== userId) {
    throw new Error("OUTLINE_VERSION_NOT_FOUND");
  }

  replaceTaskOutlineVersions(
    taskId,
    existingVersions.map((version) => ({
      ...version,
      isApproved: version.id === targetVersionId
    }))
  );

  const approvedVersion = getTaskOutlineVersion(taskId, targetVersionId);
  const nextTask = patchTaskSummary(taskId, {
    status: "drafting",
    latestOutlineVersionId: targetVersionId
  });

  if (!approvedVersion || !nextTask) {
    throw new Error("OUTLINE_VERSION_NOT_FOUND");
  }

  return {
    task: nextTask,
    outlineVersion: approvedVersion
  };
}

async function approveOutlineVersionWithSupabase({
  taskId,
  userId,
  outlineVersionId
}: ApproveOutlineInput): Promise<OutlineActionResult> {
  const task = await getOwnedTaskWithSupabase(taskId, userId);
  const targetVersionId = outlineVersionId ?? task.latestOutlineVersionId;

  if (!targetVersionId) {
    throw new Error("OUTLINE_VERSION_NOT_FOUND");
  }

  const client = createSupabaseAdminClient();
  const { error: resetError } = await client
    .from("outline_versions")
    .update({
      is_approved: false
    })
    .eq("task_id", taskId)
    .eq("user_id", userId);

  if (resetError) {
    throw new Error(`重置大纲审批状态失败：${resetError.message}`);
  }

  const { data, error } = await client
    .from("outline_versions")
    .update({
      is_approved: true
    })
    .eq("id", targetVersionId)
    .eq("task_id", taskId)
    .eq("user_id", userId)
    .select(
      "id,task_id,user_id,version_number,english_outline,feedback,is_approved,target_word_count,citation_style,created_at"
    )
    .maybeSingle();

  if (error) {
    throw new Error(`确认大纲失败：${error.message}`);
  }

  if (!data) {
    throw new Error("OUTLINE_VERSION_NOT_FOUND");
  }

  const { error: taskError } = await client
    .from("writing_tasks")
    .update({
      status: "drafting",
      latest_outline_version_id: targetVersionId
    })
    .eq("id", taskId)
    .eq("user_id", userId);

  if (taskError) {
    throw new Error(`更新任务状态失败：${taskError.message}`);
  }

  return {
    task: {
      ...task,
      status: "drafting",
      latestOutlineVersionId: targetVersionId
    },
    outlineVersion: mapOutlineVersionRow(data)
  };
}

function getOwnedTaskLocally(taskId: string, userId: string) {
  const task = getTaskSummary(taskId);

  if (!task || task.userId !== userId) {
    throw new Error("TASK_NOT_FOUND");
  }

  return task;
}

async function getOwnedTaskWithSupabase(taskId: string, userId: string) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("writing_tasks")
    .select(
      "id,status,target_word_count,citation_style,special_requirements,topic,requested_chapter_count,outline_revision_count,primary_requirement_file_id,latest_outline_version_id,analysis_snapshot"
    )
    .eq("id", taskId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`读取任务失败：${error.message}`);
  }

  if (!data) {
    throw new Error("TASK_NOT_FOUND");
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
        ? data.analysis_snapshot
        : null
  } satisfies TaskSummary;
}

function mapOutlineVersionRow(row: {
  id: string;
  task_id: string;
  user_id: string;
  version_number: number;
  english_outline: string;
  feedback: string;
  is_approved: boolean;
  target_word_count: number;
  citation_style: string;
  created_at: string;
}) {
  return {
    id: String(row.id),
    taskId: String(row.task_id),
    userId: String(row.user_id),
    versionNumber: Number(row.version_number),
    outline: JSON.parse(String(row.english_outline)) as OutlineScaffold,
    feedback: String(row.feedback ?? ""),
    isApproved: Boolean(row.is_approved),
    targetWordCount: Number(row.target_word_count),
    citationStyle: String(row.citation_style),
    createdAt: String(row.created_at)
  } satisfies TaskOutlineVersion;
}

async function getTaskOutlineVersionWithSupabase(
  taskId: string,
  userId: string,
  outlineVersionId: string
) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("outline_versions")
    .select(
      "id,task_id,user_id,version_number,english_outline,feedback,is_approved,target_word_count,citation_style,created_at"
    )
    .eq("task_id", taskId)
    .eq("user_id", userId)
    .eq("id", outlineVersionId)
    .maybeSingle();

  if (error) {
    throw new Error(`读取上一版大纲失败：${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapOutlineVersionRow(data);
}

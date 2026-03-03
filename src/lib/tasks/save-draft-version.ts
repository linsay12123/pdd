import { randomUUID } from "node:crypto";
import { countBodyWords } from "@/src/lib/drafts/word-count";
import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import {
  getTaskSummary,
  listTaskDraftVersions,
  patchTaskSummary,
  saveTaskDraftVersion
} from "@/src/lib/tasks/repository";
import type { TaskDraftVersion, TaskSummary } from "@/src/types/tasks";

type SaveDraftVersionInput = {
  taskId: string;
  userId: string;
  markdown: string;
  isActive: boolean;
  isCandidate: boolean;
};

const referencesHeadingPattern = /^#{0,2}\s*References\s*$/im;

export async function saveDraftVersion(
  input: SaveDraftVersionInput
): Promise<TaskDraftVersion> {
  return shouldUseSupabasePersistence()
    ? saveDraftVersionWithSupabase(input)
    : saveDraftVersionLocally(input);
}

function splitDraftMarkdown(markdown: string) {
  const normalized = markdown.trim();
  const lines = normalized.split("\n");
  const firstHeading = lines.find((line) => /^#\s+/.test(line.trim()));
  const title = firstHeading?.replace(/^#\s+/, "").trim() || "Untitled Draft";
  const [bodyBlock, referencesBlock = ""] = normalized.split(referencesHeadingPattern);

  return {
    title,
    bodyMarkdown: bodyBlock.trim(),
    referencesMarkdown: referencesBlock.trim()
  };
}

async function saveDraftVersionLocally({
  taskId,
  userId,
  markdown,
  isActive,
  isCandidate
}: SaveDraftVersionInput) {
  const task = requireOwnedTaskLocally(taskId, userId);
  const versionNumber = listTaskDraftVersions(taskId).length + 1;
  const parts = splitDraftMarkdown(markdown);
  const bodyWordCount = countBodyWords(markdown);
  const draft = saveTaskDraftVersion({
    id: randomUUID(),
    taskId,
    userId,
    versionNumber,
    title: parts.title,
    bodyMarkdown: parts.bodyMarkdown,
    bodyWordCount,
    referencesMarkdown: parts.referencesMarkdown,
    isActive,
    isCandidate
  });

  patchTaskSummary(taskId, {
    latestDraftVersionId: isActive ? draft.id : task.latestDraftVersionId ?? null,
    currentCandidateDraftId: isCandidate ? draft.id : null
  });

  return draft;
}

async function saveDraftVersionWithSupabase({
  taskId,
  userId,
  markdown,
  isActive,
  isCandidate
}: SaveDraftVersionInput) {
  const task = await requireOwnedTaskWithSupabase(taskId, userId);
  const client = createSupabaseAdminClient();
  const { data: latestRow, error: latestError } = await client
    .from("draft_versions")
    .select("version_number")
    .eq("task_id", taskId)
    .eq("user_id", userId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    throw new Error(`读取正文版本失败：${latestError.message}`);
  }

  const parts = splitDraftMarkdown(markdown);
  const bodyWordCount = countBodyWords(markdown);
  const versionNumber = Number(latestRow?.version_number ?? 0) + 1;
  const { data, error } = await client
    .from("draft_versions")
    .insert({
      task_id: taskId,
      user_id: userId,
      version_number: versionNumber,
      body_markdown: parts.bodyMarkdown,
      body_word_count: bodyWordCount,
      references_markdown: parts.referencesMarkdown,
      is_active: isActive,
      is_candidate: isCandidate
    })
    .select(
      "id,task_id,user_id,version_number,body_markdown,body_word_count,references_markdown,is_active,is_candidate,created_at"
    )
    .single();

  if (error || !data) {
    throw new Error(`保存正文版本失败：${error?.message ?? "数据库没有返回正文版本"}`);
  }

  const draft = {
    id: String(data.id),
    taskId: String(data.task_id),
    userId: String(data.user_id),
    versionNumber: Number(data.version_number),
    title: parts.title,
    bodyMarkdown: String(data.body_markdown),
    bodyWordCount: Number(data.body_word_count),
    referencesMarkdown: String(data.references_markdown ?? ""),
    isActive: Boolean(data.is_active),
    isCandidate: Boolean(data.is_candidate),
    createdAt: String(data.created_at)
  } satisfies TaskDraftVersion;

  const { error: taskError } = await client
    .from("writing_tasks")
    .update({
      latest_draft_version_id: isActive ? draft.id : task.latestDraftVersionId ?? null,
      current_candidate_draft_id: isCandidate ? draft.id : null
    })
    .eq("id", taskId)
    .eq("user_id", userId);

  if (taskError) {
    throw new Error(`更新任务正文状态失败：${taskError.message}`);
  }

  return draft;
}

function requireOwnedTaskLocally(taskId: string, userId: string) {
  const task = getTaskSummary(taskId);

  if (!task || task.userId !== userId) {
    throw new Error("TASK_NOT_FOUND");
  }

  return task;
}

async function requireOwnedTaskWithSupabase(taskId: string, userId: string) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("writing_tasks")
    .select("id,user_id,latest_draft_version_id,current_candidate_draft_id")
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
    userId: String(data.user_id),
    latestDraftVersionId: data.latest_draft_version_id
      ? String(data.latest_draft_version_id)
      : null,
    currentCandidateDraftId: data.current_candidate_draft_id
      ? String(data.current_candidate_draft_id)
      : null
  } as Pick<TaskSummary, "id" | "userId" | "latestDraftVersionId" | "currentCandidateDraftId">;
}

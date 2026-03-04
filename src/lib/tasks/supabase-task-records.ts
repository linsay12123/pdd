import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import type {
  TaskAnalysisSnapshot,
  TaskDraftVersion,
  TaskStatus,
  TaskSummary
} from "@/src/types/tasks";

type TaskRow = {
  id: string;
  user_id: string;
  status: TaskStatus;
  target_word_count: number | null;
  citation_style: string | null;
  special_requirements: string | null;
  topic: string | null;
  requested_chapter_count: number | null;
  outline_revision_count: number | null;
  primary_requirement_file_id: string | null;
  analysis_snapshot: unknown;
  analysis_status: "pending" | "succeeded" | "failed" | null;
  analysis_model: string | null;
  analysis_completed_at: string | null;
  latest_outline_version_id: string | null;
  latest_draft_version_id: string | null;
  current_candidate_draft_id: string | null;
  quota_reservation?: TaskSummary["quotaReservation"];
};

type DraftRow = {
  id: string;
  task_id: string;
  user_id: string;
  version_number: number;
  body_markdown: string;
  body_word_count: number;
  references_markdown: string | null;
  is_active: boolean;
  is_candidate: boolean;
  created_at: string;
};

export async function getOwnedTaskFromSupabase(taskId: string, userId: string) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("writing_tasks")
    .select(
      "id,user_id,status,target_word_count,citation_style,special_requirements,topic,requested_chapter_count,outline_revision_count,primary_requirement_file_id,analysis_snapshot,analysis_status,analysis_model,analysis_completed_at,latest_outline_version_id,latest_draft_version_id,current_candidate_draft_id,quota_reservation"
    )
    .eq("id", taskId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`读取任务失败：${error.message}`);
  }

  return data ? mapTaskRow(data as TaskRow) : null;
}

export async function getLatestOwnedDraftFromSupabase(taskId: string, userId: string) {
  const client = createSupabaseAdminClient();
  const activeResult = await client
    .from("draft_versions")
    .select(
      "id,task_id,user_id,version_number,body_markdown,body_word_count,references_markdown,is_active,is_candidate,created_at"
    )
    .eq("task_id", taskId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeResult.error) {
    throw new Error(`读取正文版本失败：${activeResult.error.message}`);
  }

  if (activeResult.data) {
    return mapDraftRow(activeResult.data as DraftRow);
  }

  const client2 = createSupabaseAdminClient();
  const latestResult = await client2
    .from("draft_versions")
    .select(
      "id,task_id,user_id,version_number,body_markdown,body_word_count,references_markdown,is_active,is_candidate,created_at"
    )
    .eq("task_id", taskId)
    .eq("user_id", userId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestResult.error) {
    throw new Error(`读取正文版本失败：${latestResult.error.message}`);
  }

  return latestResult.data ? mapDraftRow(latestResult.data as DraftRow) : null;
}

export async function setOwnedTaskStatusInSupabase(
  taskId: string,
  userId: string,
  status: TaskStatus
) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("writing_tasks")
    .update({ status })
    .eq("id", taskId)
    .eq("user_id", userId)
    .select(
      "id,user_id,status,target_word_count,citation_style,special_requirements,topic,requested_chapter_count,outline_revision_count,primary_requirement_file_id,analysis_snapshot,analysis_status,analysis_model,analysis_completed_at,latest_outline_version_id,latest_draft_version_id,current_candidate_draft_id,quota_reservation"
    )
    .maybeSingle();

  if (error) {
    throw new Error(`更新任务状态失败：${error.message}`);
  }

  if (!data) {
    throw new Error("TASK_NOT_FOUND");
  }

  return mapTaskRow(data as TaskRow);
}

export async function setOwnedTaskQuotaReservationInSupabase(
  taskId: string,
  userId: string,
  reservation: TaskSummary["quotaReservation"] | null
) {
  const client = createSupabaseAdminClient();
  const { error } = await client
    .from("writing_tasks")
    .update({
      quota_reservation: reservation
    })
    .eq("id", taskId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`更新任务积分快照失败：${error.message}`);
  }
}

function mapTaskRow(row: TaskRow) {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    status: row.status,
    targetWordCount:
      typeof row.target_word_count === "number" ? Number(row.target_word_count) : null,
    citationStyle: row.citation_style ? String(row.citation_style) : null,
    specialRequirements: String(row.special_requirements ?? ""),
    topic: row.topic ? String(row.topic) : null,
    requestedChapterCount:
      typeof row.requested_chapter_count === "number"
        ? Number(row.requested_chapter_count)
        : null,
    outlineRevisionCount: Number(row.outline_revision_count ?? 0),
    primaryRequirementFileId: row.primary_requirement_file_id
      ? String(row.primary_requirement_file_id)
      : null,
    analysisSnapshot:
      row.analysis_snapshot && typeof row.analysis_snapshot === "object"
        ? (row.analysis_snapshot as TaskAnalysisSnapshot)
        : null,
    analysisStatus: row.analysis_status ?? undefined,
    analysisModel: row.analysis_model ? String(row.analysis_model) : null,
    analysisCompletedAt: row.analysis_completed_at
      ? String(row.analysis_completed_at)
      : null,
    latestOutlineVersionId: row.latest_outline_version_id
      ? String(row.latest_outline_version_id)
      : null,
    latestDraftVersionId: row.latest_draft_version_id
      ? String(row.latest_draft_version_id)
      : null,
    currentCandidateDraftId: row.current_candidate_draft_id
      ? String(row.current_candidate_draft_id)
      : null,
    quotaReservation: row.quota_reservation ?? undefined
  } satisfies TaskSummary;
}

function mapDraftRow(row: DraftRow) {
  const firstHeading = row.body_markdown
    .split("\n")
    .find((line) => /^#\s+/.test(line.trim()));

  return {
    id: String(row.id),
    taskId: String(row.task_id),
    userId: String(row.user_id),
    versionNumber: Number(row.version_number),
    title: firstHeading?.replace(/^#\s+/, "").trim() || "Untitled Draft",
    bodyMarkdown: String(row.body_markdown),
    bodyWordCount: Number(row.body_word_count),
    referencesMarkdown: String(row.references_markdown ?? ""),
    isActive: Boolean(row.is_active),
    isCandidate: Boolean(row.is_candidate),
    createdAt: String(row.created_at)
  } satisfies TaskDraftVersion;
}

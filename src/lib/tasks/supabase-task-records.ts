import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { normalizeAnalysisModel } from "@/src/lib/tasks/analysis-runtime-cleanup";
import { assertStatusTransition } from "@/src/lib/tasks/status-machine";
import {
  buildWorkflowStageTimestamps,
  isWorkflowStageTimestampsColumnMissingError,
  normalizeWorkflowStageTimestamps
} from "@/src/lib/tasks/workflow-stage-timestamps";
import type {
  TaskHumanizeStatus,
  TaskAnalysisSnapshot,
  TaskDraftVersion,
  TaskStatus,
  TaskSummary,
  TaskWorkflowStage
} from "@/src/types/tasks";
import type { HumanizeProfile } from "@/src/lib/humanize/humanize-provider";

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
  analysis_retry_count: number | null;
  analysis_error_message: string | null;
  analysis_trigger_run_id: string | null;
  analysis_requested_at: string | null;
  analysis_started_at: string | null;
  analysis_completed_at: string | null;
  latest_outline_version_id: string | null;
  latest_draft_version_id: string | null;
  current_candidate_draft_id: string | null;
  humanize_status: TaskHumanizeStatus | null;
  humanize_provider: string | null;
  humanize_profile_snapshot: unknown;
  humanize_document_id: string | null;
  humanize_retry_document_id: string | null;
  humanize_error_message: string | null;
  humanize_requested_at: string | null;
  humanize_completed_at: string | null;
  approval_attempt_count: number | null;
  last_workflow_stage: TaskWorkflowStage | null;
  workflow_stage_timestamps?: unknown;
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

const ownedTaskBaseSelect =
  "id,user_id,status,target_word_count,citation_style,special_requirements,topic,requested_chapter_count,outline_revision_count,primary_requirement_file_id,analysis_snapshot,analysis_status,analysis_model,analysis_retry_count,analysis_error_message,analysis_trigger_run_id,analysis_requested_at,analysis_started_at,analysis_completed_at,latest_outline_version_id,latest_draft_version_id,current_candidate_draft_id,approval_attempt_count,last_workflow_stage,quota_reservation";

const ownedTaskHumanizeSelect =
  ",humanize_status,humanize_provider,humanize_profile_snapshot,humanize_document_id,humanize_retry_document_id,humanize_error_message,humanize_requested_at,humanize_completed_at";

const ownedTaskSelectWithWorkflowStageTimestamps =
  `${ownedTaskBaseSelect},workflow_stage_timestamps${ownedTaskHumanizeSelect}`;

const ownedTaskSelectLegacy = `${ownedTaskBaseSelect}${ownedTaskHumanizeSelect}`;

export async function getOwnedTaskFromSupabase(taskId: string, userId: string) {
  const { data, error } = await selectOwnedTaskRow(taskId, userId);

  if (error) {
    throw new Error(`读取任务失败：${error.message}`);
  }

  return data ? mapTaskRow(data as unknown as TaskRow) : null;
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
  status: TaskStatus,
  options: {
    fromStatuses?: TaskStatus[];
    lastWorkflowStage?: TaskWorkflowStage | null;
    resetWorkflowStageTimestamps?: boolean;
    workflowStageTimestampRecordedAt?: string;
  } = {}
) {
  const currentTaskState = await readOwnedTaskWorkflowState(taskId, userId);
  const currentStatus = currentTaskState.status;

  if (options.fromStatuses && !options.fromStatuses.includes(currentStatus)) {
    throw new Error("TASK_STATUS_CONFLICT");
  }

  assertStatusTransition(currentStatus, status);

  const client = createSupabaseAdminClient();
  const nextWorkflowStage =
    options.lastWorkflowStage !== undefined
      ? options.lastWorkflowStage
      : status === "drafting" ||
          status === "adjusting_word_count" ||
          status === "verifying_references" ||
          status === "exporting"
      ? status
      : undefined;
  const nextWorkflowStageTimestamps = buildWorkflowStageTimestamps({
    current: currentTaskState.workflowStageTimestamps,
    status,
    recordedAt: options.workflowStageTimestampRecordedAt,
    reset: options.resetWorkflowStageTimestamps
  });

  const updatePayload: Record<string, unknown> = {
    status,
    ...(nextWorkflowStage !== undefined
      ? { last_workflow_stage: nextWorkflowStage }
      : {}),
    workflow_stage_timestamps: nextWorkflowStageTimestamps
  };

  let data: TaskRow | null = null;
  let error: { message: string } | null = null;

  {
    const result = await client
      .from("writing_tasks")
      .update(updatePayload)
      .eq("id", taskId)
      .eq("user_id", userId)
      .eq("status", currentStatus)
      .select(ownedTaskSelectWithWorkflowStageTimestamps)
      .maybeSingle();
    data = result.data as TaskRow | null;
    error = result.error;
  }

  if (error && isWorkflowStageTimestampsColumnMissingError(error)) {
    const { workflow_stage_timestamps: _ignored, ...legacyUpdatePayload } = updatePayload;
    const legacyResult = await client
      .from("writing_tasks")
      .update(legacyUpdatePayload)
      .eq("id", taskId)
      .eq("user_id", userId)
      .eq("status", currentStatus)
      .select(ownedTaskSelectLegacy)
      .maybeSingle();
    data = legacyResult.data as TaskRow | null;
    error = legacyResult.error;
  }

  if (error) {
    throw new Error(`更新任务状态失败：${error.message}`);
  }

  if (!data) {
    throw new Error("TASK_STATUS_CONFLICT");
  }

  return mapTaskRow(data as unknown as TaskRow);
}

export async function updateOwnedTaskHumanizeStateInSupabase(
  taskId: string,
  userId: string,
  input: {
    status?: TaskHumanizeStatus;
    provider?: string | null;
    profileSnapshot?: HumanizeProfile | null;
    documentId?: string | null;
    retryDocumentId?: string | null;
    errorMessage?: string | null;
    requestedAt?: string | null;
    completedAt?: string | null;
  }
) {
  const client = createSupabaseAdminClient();
  const patch: Record<string, unknown> = {};

  if (input.status !== undefined) patch.humanize_status = input.status;
  if (input.provider !== undefined) patch.humanize_provider = input.provider;
  if (input.profileSnapshot !== undefined) patch.humanize_profile_snapshot = input.profileSnapshot;
  if (input.documentId !== undefined) patch.humanize_document_id = input.documentId;
  if (input.retryDocumentId !== undefined) patch.humanize_retry_document_id = input.retryDocumentId;
  if (input.errorMessage !== undefined) patch.humanize_error_message = input.errorMessage;
  if (input.requestedAt !== undefined) patch.humanize_requested_at = input.requestedAt;
  if (input.completedAt !== undefined) patch.humanize_completed_at = input.completedAt;

  let data: TaskRow | null = null;
  let error: { message: string } | null = null;
  {
    const result = await client
      .from("writing_tasks")
      .update(patch)
      .eq("id", taskId)
      .eq("user_id", userId)
      .select(ownedTaskSelectWithWorkflowStageTimestamps)
      .maybeSingle();
    data = result.data as TaskRow | null;
    error = result.error;
  }

  if (error && isWorkflowStageTimestampsColumnMissingError(error)) {
    const legacyResult = await client
      .from("writing_tasks")
      .update(patch)
      .eq("id", taskId)
      .eq("user_id", userId)
      .select(ownedTaskSelectLegacy)
      .maybeSingle();
    data = legacyResult.data as TaskRow | null;
    error = legacyResult.error;
  }

  if (error) {
    throw new Error(`更新降AI状态失败：${error.message}`);
  }

  if (!data) {
    throw new Error("TASK_NOT_FOUND");
  }

  return mapTaskRow(data as unknown as TaskRow);
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
    analysisModel: normalizeAnalysisModel(row.analysis_model ? String(row.analysis_model) : null),
    analysisRetryCount: Number(row.analysis_retry_count ?? 0),
    analysisErrorMessage: row.analysis_error_message
      ? String(row.analysis_error_message)
      : null,
    analysisTriggerRunId: row.analysis_trigger_run_id
      ? String(row.analysis_trigger_run_id)
      : null,
    analysisRequestedAt: row.analysis_requested_at
      ? String(row.analysis_requested_at)
      : null,
    analysisStartedAt: row.analysis_started_at
      ? String(row.analysis_started_at)
      : null,
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
    humanizeStatus: row.humanize_status ?? "idle",
    humanizeProvider: row.humanize_provider ? String(row.humanize_provider) : null,
    humanizeProfileSnapshot:
      row.humanize_profile_snapshot && typeof row.humanize_profile_snapshot === "object"
        ? (row.humanize_profile_snapshot as HumanizeProfile)
        : null,
    humanizeDocumentId: row.humanize_document_id ? String(row.humanize_document_id) : null,
    humanizeRetryDocumentId: row.humanize_retry_document_id
      ? String(row.humanize_retry_document_id)
      : null,
    humanizeErrorMessage: row.humanize_error_message
      ? String(row.humanize_error_message)
      : null,
    humanizeRequestedAt: row.humanize_requested_at
      ? String(row.humanize_requested_at)
      : null,
    humanizeCompletedAt: row.humanize_completed_at
      ? String(row.humanize_completed_at)
      : null,
    approvalAttemptCount: Number(row.approval_attempt_count ?? 0),
    lastWorkflowStage: row.last_workflow_stage
      ? (String(row.last_workflow_stage) as TaskWorkflowStage)
      : null,
    workflowStageTimestamps: normalizeWorkflowStageTimestamps(
      row.workflow_stage_timestamps
    ),
    quotaReservation: row.quota_reservation ?? undefined
  } satisfies TaskSummary;
}

async function readOwnedTaskWorkflowState(
  taskId: string,
  userId: string
): Promise<{
  status: TaskStatus;
  workflowStageTimestamps: TaskSummary["workflowStageTimestamps"];
}> {
  const client = createSupabaseAdminClient();
  let data: { status: TaskStatus; workflow_stage_timestamps?: unknown } | null = null;
  let error: { message: string } | null = null;
  {
    const result = await client
      .from("writing_tasks")
      .select("status,workflow_stage_timestamps")
      .eq("id", taskId)
      .eq("user_id", userId)
      .maybeSingle();
    data = result.data as { status: TaskStatus; workflow_stage_timestamps?: unknown } | null;
    error = result.error;
  }

  if (error && isWorkflowStageTimestampsColumnMissingError(error)) {
    const legacyResult = await client
      .from("writing_tasks")
      .select("status")
      .eq("id", taskId)
      .eq("user_id", userId)
      .maybeSingle();
    data = legacyResult.data;
    error = legacyResult.error;
  }

  if (error) {
    throw new Error(`读取任务状态失败：${error.message}`);
  }

  if (!data) {
    throw new Error("TASK_NOT_FOUND");
  }

  return {
    status: data.status as TaskStatus,
    workflowStageTimestamps: normalizeWorkflowStageTimestamps(
      (data as { workflow_stage_timestamps?: unknown }).workflow_stage_timestamps
    )
  };
}

async function selectOwnedTaskRow(taskId: string, userId: string) {
  const client = createSupabaseAdminClient();
  let data: TaskRow | null = null;
  let error: { message: string } | null = null;
  {
    const result = await client
      .from("writing_tasks")
      .select(ownedTaskSelectWithWorkflowStageTimestamps)
      .eq("id", taskId)
      .eq("user_id", userId)
      .maybeSingle();
    data = result.data as TaskRow | null;
    error = result.error;
  }

  if (error && isWorkflowStageTimestampsColumnMissingError(error)) {
    const legacyResult = await client
      .from("writing_tasks")
      .select(ownedTaskSelectLegacy)
      .eq("id", taskId)
      .eq("user_id", userId)
      .maybeSingle();
    data = legacyResult.data;
    error = legacyResult.error;
  }

  return { data, error };
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

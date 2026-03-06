import { randomUUID } from "node:crypto";
import {
  requireFormalPersistence,
  shouldUseLocalTestPersistence,
  shouldUseSupabasePersistence
} from "@/src/lib/persistence/runtime-mode";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import {
  getTaskDraftVersion,
  getTaskSummary,
  saveTaskReferenceChecks
} from "@/src/lib/tasks/repository";
import type { TaskReferenceCheck } from "@/src/types/tasks";

type SaveReferenceChecksInput = {
  taskId: string;
  draftVersionId: string;
  userId: string;
  checks: Array<{
    rawReference: string;
    detectedTitle?: string;
    detectedYear?: string;
    detectedDoi?: string;
    detectedUrl?: string;
    verdict: "matching" | "risky";
    reasoning: string;
  }>;
};

export async function saveReferenceChecks(
  input: SaveReferenceChecksInput
): Promise<TaskReferenceCheck[]> {
  if (shouldUseSupabasePersistence()) {
    return saveReferenceChecksWithSupabase(input);
  }

  if (shouldUseLocalTestPersistence()) {
    return saveReferenceChecksLocally(input);
  }

  requireFormalPersistence();
}

async function saveReferenceChecksLocally({
  taskId,
  draftVersionId,
  userId,
  checks
}: SaveReferenceChecksInput) {
  const task = getTaskSummary(taskId);
  const draft = getTaskDraftVersion(taskId, draftVersionId);

  if (!task || task.userId !== userId || !draft || draft.userId !== userId) {
    throw new Error("TASK_NOT_FOUND");
  }

  return saveTaskReferenceChecks(
    checks.map((check) => ({
      id: randomUUID(),
      taskId,
      draftVersionId,
      userId,
      ...check
    }))
  );
}

async function saveReferenceChecksWithSupabase({
  taskId,
  draftVersionId,
  userId,
  checks
}: SaveReferenceChecksInput) {
  const client = createSupabaseAdminClient();
  const { data: draft, error: draftError } = await client
    .from("draft_versions")
    .select("id")
    .eq("id", draftVersionId)
    .eq("task_id", taskId)
    .eq("user_id", userId)
    .maybeSingle();

  if (draftError) {
    throw new Error(`读取正文版本失败：${draftError.message}`);
  }

  if (!draft) {
    throw new Error("TASK_NOT_FOUND");
  }

  const { data, error } = await client
    .from("reference_checks")
    .insert(
      checks.map((check) => ({
        task_id: taskId,
        draft_version_id: draftVersionId,
        user_id: userId,
        raw_reference: check.rawReference,
        detected_title: check.detectedTitle,
        detected_year: check.detectedYear,
        detected_doi: check.detectedDoi,
        detected_url: check.detectedUrl,
        verdict: check.verdict,
        reasoning: check.reasoning
      }))
    )
    .select(
      "id,task_id,draft_version_id,user_id,raw_reference,detected_title,detected_year,detected_doi,detected_url,verdict,reasoning,created_at"
    );

  if (error || !data) {
    throw new Error(`保存引用核验失败：${error?.message ?? "数据库没有返回引用核验结果"}`);
  }

  return data.map((row) => ({
    id: String(row.id),
    taskId: String(row.task_id),
    draftVersionId: String(row.draft_version_id),
    userId: String(row.user_id),
    rawReference: String(row.raw_reference),
    detectedTitle: row.detected_title ? String(row.detected_title) : undefined,
    detectedYear: row.detected_year ? String(row.detected_year) : undefined,
    detectedDoi: row.detected_doi ? String(row.detected_doi) : undefined,
    detectedUrl: row.detected_url ? String(row.detected_url) : undefined,
    verdict: row.verdict,
    reasoning: String(row.reasoning),
    createdAt: String(row.created_at)
  })) satisfies TaskReferenceCheck[];
}

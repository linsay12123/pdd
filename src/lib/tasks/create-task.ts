import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import { resolveGenerationTaskQuotaCost } from "@/src/lib/tasks/task-cost";
import type { SessionUser } from "@/src/types/auth";
import type { TaskSummary } from "@/src/types/tasks";

type CreateTaskInput = {
  user: SessionUser;
  specialRequirements: string;
  targetWordCount?: number | null;
  citationStyle?: string | null;
};

type CreateTaskResult = {
  task: TaskSummary;
  frozenQuota: number;
};

/**
 * Creates a task WITHOUT freezing quota.
 * Quota is only frozen later when the user approves the outline (right before writing starts).
 * We still check that the user has enough balance to prevent obviously-insufficient accounts.
 */
export async function createTaskWithQuotaFreeze(
  input: CreateTaskInput
): Promise<CreateTaskResult> {
  if (!shouldUseSupabasePersistence()) {
    throw new Error("REAL_PERSISTENCE_REQUIRED");
  }

  return createTaskWithSupabase(input);
}

async function createTaskWithSupabase(
  input: CreateTaskInput
): Promise<CreateTaskResult> {
  const client = createSupabaseAdminClient();
  const quotaCost = resolveGenerationTaskQuotaCost(input.targetWordCount ?? 2000);
  const { data: walletRow, error: walletError } = await client
    .from("quota_wallets")
    .select("recharge_quota,subscription_quota,frozen_quota")
    .eq("user_id", input.user.id)
    .maybeSingle();

  if (walletError) {
    throw new Error(`读取积分余额失败：${walletError.message}`);
  }

  const totalAvailable =
    Number(walletRow?.recharge_quota ?? 0) +
    Number(walletRow?.subscription_quota ?? 0);

  if (totalAvailable < quotaCost) {
    throw new Error("INSUFFICIENT_QUOTA");
  }

  const baseInsert = {
    user_id: input.user.id,
    status: "created" as const,
    target_word_count: null,
    citation_style: null,
    special_requirements: input.specialRequirements
  };

  const { data: taskRow, error: taskError } = await client
    .from("writing_tasks")
    .insert(baseInsert)
    .select("id")
    .single();

  if (taskError || !taskRow) {
    if (
      taskError?.message?.includes("target_word_count") &&
      taskError.message.includes("not-null constraint")
    ) {
      throw new Error("DATABASE_SCHEMA_OUT_OF_SYNC");
    }

    if (
      taskError?.message?.includes("citation_style") &&
      taskError.message.includes("not-null constraint")
    ) {
      throw new Error("DATABASE_SCHEMA_OUT_OF_SYNC");
    }

    throw new Error(`创建任务失败：${taskError?.message ?? "数据库没有返回任务"}`);
  }

  const taskId = String(taskRow.id);

  const task = {
    id: taskId,
    userId: input.user.id,
    status: "created",
    targetWordCount: null,
    citationStyle: null,
    specialRequirements: input.specialRequirements,
    analysisStatus: "pending",
    analysisModel: null,
    analysisCompletedAt: null,
    analysisSnapshot: null
  } satisfies TaskSummary;

  return {
    task,
    frozenQuota: 0
  };
}

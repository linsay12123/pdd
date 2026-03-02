import { randomUUID } from "node:crypto";
import { freezeQuota } from "@/src/lib/billing/freeze-quota";
import { appendPaymentLedgerEntry, getUserWallet, setUserWallet } from "@/src/lib/payments/repository";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import { resolveGenerationTaskQuotaCost } from "@/src/lib/tasks/task-cost";
import { saveTaskSummary } from "@/src/lib/tasks/repository";
import type { SessionUser } from "@/src/types/auth";
import type { TaskSummary } from "@/src/types/tasks";

type CreateTaskInput = {
  user: SessionUser;
  specialRequirements: string;
  targetWordCount: number;
  citationStyle: string;
};

type CreateTaskResult = {
  task: TaskSummary;
  frozenQuota: number;
};

export async function createTaskWithQuotaFreeze(
  input: CreateTaskInput
): Promise<CreateTaskResult> {
  return shouldUseSupabasePersistence()
    ? createTaskWithSupabase(input)
    : createTaskLocally(input);
}

async function createTaskLocally(input: CreateTaskInput): Promise<CreateTaskResult> {
  const quotaCost = resolveGenerationTaskQuotaCost(input.targetWordCount);
  const taskId = `task_${randomUUID()}`;
  const wallet = getUserWallet(input.user.id);
  let frozen;

  try {
    frozen = freezeQuota({
      wallet,
      amount: quotaCost,
      taskId,
      chargePath: "generation"
    });
  } catch {
    throw new Error("INSUFFICIENT_QUOTA");
  }

  setUserWallet(input.user.id, frozen.wallet);
  appendPaymentLedgerEntry(input.user.id, frozen.entry);

  const task = saveTaskSummary({
    id: taskId,
    userId: input.user.id,
    status: "quota_frozen",
    targetWordCount: input.targetWordCount,
    citationStyle: input.citationStyle,
    specialRequirements: input.specialRequirements
  });

  return {
    task,
    frozenQuota: quotaCost
  };
}

async function createTaskWithSupabase(
  input: CreateTaskInput
): Promise<CreateTaskResult> {
  const client = createSupabaseAdminClient();
  const quotaCost = resolveGenerationTaskQuotaCost(input.targetWordCount);
  const { data: walletRow, error: walletError } = await client
    .from("quota_wallets")
    .select("recharge_quota,subscription_quota,frozen_quota")
    .eq("user_id", input.user.id)
    .maybeSingle();

  if (walletError) {
    throw new Error(`读取积分余额失败：${walletError.message}`);
  }

  const wallet = {
    rechargeQuota: Number(walletRow?.recharge_quota ?? 0),
    subscriptionQuota: Number(walletRow?.subscription_quota ?? 0),
    frozenQuota: Number(walletRow?.frozen_quota ?? 0)
  };

  let frozen;

  try {
    frozen = freezeQuota({
      wallet,
      amount: quotaCost,
      taskId: randomUUID(),
      chargePath: "generation"
    });
  } catch {
    throw new Error("INSUFFICIENT_QUOTA");
  }

  const { data: taskRow, error: taskError } = await client
    .from("writing_tasks")
    .insert({
      user_id: input.user.id,
      status: "quota_frozen",
      target_word_count: input.targetWordCount,
      citation_style: input.citationStyle,
      special_requirements: input.specialRequirements
    })
    .select("id,status,target_word_count,citation_style,special_requirements")
    .single();

  if (taskError || !taskRow) {
    throw new Error(`创建任务失败：${taskError?.message ?? "数据库没有返回任务"}`);
  }

  const taskId = String(taskRow.id);
  const finalFrozen = {
    ...frozen,
    reservation: {
      ...frozen.reservation,
      taskId
    },
    entry: {
      ...frozen.entry,
      taskId,
      ledgerKey: `${taskId}:${frozen.entry.kind}:${frozen.entry.amount}`
    }
  };

  const { error: walletUpdateError } = await client
    .from("quota_wallets")
    .update({
      recharge_quota: finalFrozen.wallet.rechargeQuota,
      subscription_quota: finalFrozen.wallet.subscriptionQuota,
      frozen_quota: finalFrozen.wallet.frozenQuota
    })
    .eq("user_id", input.user.id);

  if (walletUpdateError) {
    await client.from("writing_tasks").delete().eq("id", taskId);
    throw new Error(`冻结积分失败：${walletUpdateError.message}`);
  }

  const { error: ledgerError } = await client
    .from("quota_ledger_entries")
    .insert({
      user_id: input.user.id,
      task_id: taskId,
      entry_kind: finalFrozen.entry.kind,
      amount: finalFrozen.entry.amount,
      balance_recharge_after: finalFrozen.wallet.rechargeQuota,
      balance_subscription_after: finalFrozen.wallet.subscriptionQuota,
      balance_frozen_after: finalFrozen.wallet.frozenQuota,
      unique_event_key: finalFrozen.entry.ledgerKey,
      metadata: {
        note: finalFrozen.entry.note
      }
    });

  if (ledgerError) {
    await client
      .from("quota_wallets")
      .update({
        recharge_quota: wallet.rechargeQuota,
        subscription_quota: wallet.subscriptionQuota,
        frozen_quota: wallet.frozenQuota
      })
      .eq("user_id", input.user.id);
    await client.from("writing_tasks").delete().eq("id", taskId);
    throw new Error(`写入积分流水失败：${ledgerError.message}`);
  }

  const task = saveTaskSummary({
    id: taskId,
    userId: input.user.id,
    status: "quota_frozen",
    targetWordCount: input.targetWordCount,
    citationStyle: input.citationStyle,
    specialRequirements: input.specialRequirements
  });

  return {
    task,
    frozenQuota: quotaCost
  };
}

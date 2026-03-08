import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import type { QuotaLedgerEntry, WalletSnapshot } from "@/src/types/billing";

export async function getUserWalletFromSupabase(userId: string): Promise<WalletSnapshot> {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("quota_wallets")
    .select("recharge_quota,subscription_quota,frozen_quota")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`读取积分余额失败：${error.message}`);
  }

  if (!data) {
    return {
      rechargeQuota: 0,
      subscriptionQuota: 0,
      frozenQuota: 0
    };
  }

  return {
    rechargeQuota: data.recharge_quota as number,
    subscriptionQuota: data.subscription_quota as number,
    frozenQuota: data.frozen_quota as number
  };
}

export async function setUserWalletInSupabase(
  userId: string,
  wallet: WalletSnapshot
) {
  const client = createSupabaseAdminClient();
  const { error } = await client
    .from("quota_wallets")
    .update({
      recharge_quota: wallet.rechargeQuota,
      subscription_quota: wallet.subscriptionQuota,
      frozen_quota: wallet.frozenQuota
    })
    .eq("user_id", userId);

  if (error) {
    throw new Error(`更新积分余额失败：${error.message}`);
  }
}

export async function appendPaymentLedgerEntryToSupabase(input: {
  userId: string;
  taskId: string;
  entry: QuotaLedgerEntry;
  walletAfter: WalletSnapshot;
}) {
  const client = createSupabaseAdminClient();
  const { error } = await client.from("quota_ledger_entries").insert({
    user_id: input.userId,
    task_id: input.taskId,
    entry_kind: input.entry.kind,
    amount: input.entry.amount,
    balance_recharge_after: input.walletAfter.rechargeQuota,
    balance_subscription_after: input.walletAfter.subscriptionQuota,
    balance_frozen_after: input.walletAfter.frozenQuota,
    unique_event_key: input.entry.ledgerKey,
    metadata: {
      note: input.entry.note
    }
  });

  if (error) {
    throw new Error(`写入积分流水失败：${error.message}`);
  }
}

export async function applyWalletMutationWithLedgerInSupabase(input: {
  userId: string;
  taskId: string;
  expectedWallet: WalletSnapshot;
  nextWallet: WalletSnapshot;
  entry: QuotaLedgerEntry;
  metadata?: Record<string, unknown>;
}) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client.rpc("apply_quota_wallet_mutation", {
    p_user_id: input.userId,
    p_task_id: input.taskId,
    p_expected_recharge: input.expectedWallet.rechargeQuota,
    p_expected_subscription: input.expectedWallet.subscriptionQuota,
    p_expected_frozen: input.expectedWallet.frozenQuota,
    p_next_recharge: input.nextWallet.rechargeQuota,
    p_next_subscription: input.nextWallet.subscriptionQuota,
    p_next_frozen: input.nextWallet.frozenQuota,
    p_entry_kind: input.entry.kind,
    p_amount: input.entry.amount,
    p_unique_event_key: input.entry.ledgerKey,
    p_note: input.entry.note,
    p_metadata: input.metadata ?? {}
  });

  if (error) {
    if (error.message.includes("WALLET_NEGATIVE_NOT_ALLOWED")) {
      throw new Error("WALLET_NEGATIVE_NOT_ALLOWED");
    }
    if (isAmbiguousQuotaColumnError(error.message)) {
      return applyWalletMutationWithDirectFallback(client, input);
    }
    throw new Error(`原子更新积分失败：${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) {
    throw new Error("WALLET_MUTATION_EMPTY_RESULT");
  }

  if (row.conflict === true) {
    throw new Error("WALLET_CONFLICT");
  }

  if (row.applied !== true) {
    throw new Error("WALLET_MUTATION_NOT_APPLIED");
  }

  return {
    rechargeQuota: Number(row.recharge_quota ?? 0),
    subscriptionQuota: Number(row.subscription_quota ?? 0),
    frozenQuota: Number(row.frozen_quota ?? 0)
  } satisfies WalletSnapshot;
}

function isAmbiguousQuotaColumnError(message: string) {
  return (
    message.includes('column reference "recharge_quota" is ambiguous') ||
    message.includes('column reference "subscription_quota" is ambiguous') ||
    message.includes('column reference "frozen_quota" is ambiguous')
  );
}

async function applyWalletMutationWithDirectFallback(
  client: ReturnType<typeof createSupabaseAdminClient>,
  input: {
    userId: string;
    taskId: string;
    expectedWallet: WalletSnapshot;
    nextWallet: WalletSnapshot;
    entry: QuotaLedgerEntry;
    metadata?: Record<string, unknown>;
  }
) {
  const { error: ensureWalletError } = await client.from("quota_wallets").upsert(
    {
      user_id: input.userId,
      recharge_quota: 0,
      subscription_quota: 0,
      frozen_quota: 0
    },
    {
      onConflict: "user_id",
      ignoreDuplicates: true
    }
  );

  if (ensureWalletError) {
    throw new Error(`原子更新积分失败：${ensureWalletError.message}`);
  }

  const { data: updatedWallet, error: walletError } = await client
    .from("quota_wallets")
    .update({
      recharge_quota: input.nextWallet.rechargeQuota,
      subscription_quota: input.nextWallet.subscriptionQuota,
      frozen_quota: input.nextWallet.frozenQuota
    })
    .eq("user_id", input.userId)
    .eq("recharge_quota", input.expectedWallet.rechargeQuota)
    .eq("subscription_quota", input.expectedWallet.subscriptionQuota)
    .eq("frozen_quota", input.expectedWallet.frozenQuota)
    .select("recharge_quota,subscription_quota,frozen_quota")
    .maybeSingle();

  if (walletError) {
    if (walletError.message.includes("WALLET_NEGATIVE_NOT_ALLOWED")) {
      throw new Error("WALLET_NEGATIVE_NOT_ALLOWED");
    }
    throw new Error(`原子更新积分失败：${walletError.message}`);
  }

  if (!updatedWallet) {
    throw new Error("WALLET_CONFLICT");
  }

  const { error: ledgerError } = await client.from("quota_ledger_entries").insert({
    user_id: input.userId,
    task_id: input.taskId,
    entry_kind: input.entry.kind,
    amount: input.entry.amount,
    balance_recharge_after: input.nextWallet.rechargeQuota,
    balance_subscription_after: input.nextWallet.subscriptionQuota,
    balance_frozen_after: input.nextWallet.frozenQuota,
    unique_event_key: input.entry.ledgerKey,
    metadata: {
      note: input.entry.note,
      ...(input.metadata ?? {})
    }
  });

  if (ledgerError) {
    const { error: revertError } = await client
      .from("quota_wallets")
      .update({
        recharge_quota: input.expectedWallet.rechargeQuota,
        subscription_quota: input.expectedWallet.subscriptionQuota,
        frozen_quota: input.expectedWallet.frozenQuota
      })
      .eq("user_id", input.userId)
      .eq("recharge_quota", input.nextWallet.rechargeQuota)
      .eq("subscription_quota", input.nextWallet.subscriptionQuota)
      .eq("frozen_quota", input.nextWallet.frozenQuota);

    const revertMessage = revertError ? `；回滚余额也失败：${revertError.message}` : "";
    throw new Error(`原子更新积分失败：${ledgerError.message}${revertMessage}`);
  }

  return {
    rechargeQuota: Number(updatedWallet.recharge_quota ?? 0),
    subscriptionQuota: Number(updatedWallet.subscription_quota ?? 0),
    frozenQuota: Number(updatedWallet.frozen_quota ?? 0)
  } satisfies WalletSnapshot;
}

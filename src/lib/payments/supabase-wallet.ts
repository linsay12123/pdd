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

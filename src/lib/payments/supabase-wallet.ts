import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import type { WalletSnapshot } from "@/src/types/billing";

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

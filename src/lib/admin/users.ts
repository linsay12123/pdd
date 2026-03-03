import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

export type AdminUserSummary = {
  id: string;
  email: string;
  displayName: string;
  role: "user" | "admin";
  status: "active" | "frozen";
  currentQuota: number;
  rechargeQuota: number;
  subscriptionQuota: number;
  frozenQuota: number;
  createdAt: string;
};

type AdminUsersDependencies = {
  shouldUseSupabase?: () => boolean;
  createClient?: typeof createSupabaseAdminClient;
};

type ProfileRow = {
  id: string;
  email: string;
  display_name: string | null;
  role: "user" | "admin";
  is_frozen: boolean;
  created_at: string;
};

type WalletRow = {
  user_id: string;
  recharge_quota: number;
  subscription_quota: number;
  frozen_quota: number;
};

export async function listAdminUsers(
  dependencies: AdminUsersDependencies = {}
): Promise<AdminUserSummary[]> {
  const useSupabase =
    (dependencies.shouldUseSupabase ?? shouldUseSupabasePersistence)();

  if (!useSupabase) {
    return [];
  }

  const client = (dependencies.createClient ?? createSupabaseAdminClient)();

  const [{ data: profiles, error: profilesError }, { data: wallets, error: walletsError }] =
    await Promise.all([
      client
        .from("profiles")
        .select("id,email,display_name,role,is_frozen,created_at")
        .order("created_at", { ascending: false }),
      client
        .from("quota_wallets")
        .select("user_id,recharge_quota,subscription_quota,frozen_quota")
    ]);

  if (profilesError) {
    throw new Error(`读取用户列表失败：${profilesError.message}`);
  }

  if (walletsError) {
    throw new Error(`读取用户积分失败：${walletsError.message}`);
  }

  const walletMap = new Map(
    ((wallets ?? []) as WalletRow[]).map((wallet) => [wallet.user_id, wallet])
  );

  return ((profiles ?? []) as ProfileRow[]).map((profile) => {
    const wallet = walletMap.get(profile.id);
    const rechargeQuota = wallet?.recharge_quota ?? 0;
    const subscriptionQuota = wallet?.subscription_quota ?? 0;
    const frozenQuota = wallet?.frozen_quota ?? 0;

    return {
      id: profile.id,
      email: profile.email,
      displayName: profile.display_name?.trim() || "未填写昵称",
      role: profile.role,
      status: profile.is_frozen ? "frozen" : "active",
      currentQuota: rechargeQuota + subscriptionQuota,
      rechargeQuota,
      subscriptionQuota,
      frozenQuota,
      createdAt: profile.created_at
    };
  });
}

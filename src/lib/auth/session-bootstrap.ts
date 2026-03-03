import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

type EnsureSessionUserBootstrapInput = {
  authUserId: string;
  email: string;
};

type EnsureSessionUserBootstrapDependencies = {
  createAdminClient?: typeof createSupabaseAdminClient;
};

function deriveDisplayName(email: string) {
  const localPart = email.trim().split("@")[0]?.trim();

  if (!localPart) {
    return "拼代代用户";
  }

  return localPart.slice(0, 40);
}

export async function ensureSessionUserBootstrap(
  input: EnsureSessionUserBootstrapInput,
  dependencies: EnsureSessionUserBootstrapDependencies = {}
) {
  const client =
    dependencies.createAdminClient?.() ?? createSupabaseAdminClient();
  const displayName = deriveDisplayName(input.email);

  const { error: profileError } = await client.from("profiles").upsert(
    {
      id: input.authUserId,
      email: input.email,
      display_name: displayName,
      role: "user",
      is_frozen: false
    },
    { onConflict: "id" }
  );

  if (profileError) {
    throw new Error(`补齐用户资料失败：${profileError.message}`);
  }

  const { error: walletError } = await client.from("quota_wallets").upsert(
    {
      user_id: input.authUserId,
      recharge_quota: 0,
      subscription_quota: 0,
      frozen_quota: 0
    },
    { onConflict: "user_id" }
  );

  if (walletError) {
    throw new Error(`补齐积分钱包失败：${walletError.message}`);
  }
}

import { randomBytes } from "node:crypto";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import type {
  ActivationCodeListQuery,
  ActivationCodeRecord,
  ActivationCodeTier
} from "@/src/types/activation-codes";

const allowedTiers = new Set<ActivationCodeTier>([1000, 5000, 10000, 20000]);

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

function buildActivationCode(tier: ActivationCodeTier) {
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return normalizeCode(`PDD-${tier}-${suffix}`);
}

function mapActivationCodeRow(row: {
  code: string;
  tier: number;
  quota_amount: number;
  created_at: string;
  used_at: string | null;
  used_by_user_id: string | null;
}): ActivationCodeRecord {
  return {
    code: row.code,
    tier: row.tier as ActivationCodeTier,
    quotaAmount: row.quota_amount,
    createdAt: row.created_at,
    usedAt: row.used_at,
    usedByUserId: row.used_by_user_id
  };
}

function assertCreateInput(input: { tier: ActivationCodeTier; count: number }) {
  if (!allowedTiers.has(input.tier)) {
    throw new Error("不支持这个激活码档位");
  }

  if (input.count <= 0) {
    throw new Error("生成数量必须大于 0");
  }

  if (input.count > 50) {
    throw new Error("最多一次生成 50 个");
  }
}

export async function createActivationCodesInSupabase(input: {
  tier: ActivationCodeTier;
  count: number;
}) {
  assertCreateInput(input);

  const client = createSupabaseAdminClient();
  const createdCodes: ActivationCodeRecord[] = [];
  let guard = 0;

  while (createdCodes.length < input.count) {
    guard += 1;

    if (guard > input.count * 20) {
      throw new Error("激活码生成失败，请稍后再试");
    }

    const code = buildActivationCode(input.tier);
    const { data, error } = await client
      .from("activation_codes")
      .insert({
        code,
        tier: input.tier,
        quota_amount: input.tier,
        status: "unused"
      })
      .select("code,tier,quota_amount,created_at,used_at,used_by_user_id")
      .single();

    if (error) {
      if (error.code === "23505") {
        continue;
      }

      throw new Error(`激活码写入数据库失败：${error.message}`);
    }

    createdCodes.push(
      mapActivationCodeRow(
        data as {
          code: string;
          tier: number;
          quota_amount: number;
          created_at: string;
          used_at: string | null;
          used_by_user_id: string | null;
        }
      )
    );
  }

  return createdCodes;
}

export async function listActivationCodesInSupabase(query: ActivationCodeListQuery = {}) {
  const client = createSupabaseAdminClient();
  let request = client
    .from("activation_codes")
    .select("code,tier,quota_amount,created_at,used_at,used_by_user_id")
    .order("created_at", { ascending: false });

  if (query.status) {
    request = request.eq("status", query.status);
  }

  if (query.keyword?.trim()) {
    request = request.ilike("code", `%${query.keyword.trim()}%`);
  }

  const { data, error } = await request;

  if (error) {
    throw new Error(`读取激活码列表失败：${error.message}`);
  }

  return (data ?? []).map((item) =>
    mapActivationCodeRow(
      item as {
        code: string;
        tier: number;
        quota_amount: number;
        created_at: string;
        used_at: string | null;
        used_by_user_id: string | null;
      }
    )
  );
}

export async function redeemActivationCodeInSupabase(input: {
  code: string;
  userId: string;
}) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client.rpc("redeem_activation_code_and_credit_wallet", {
    p_user_id: input.userId,
    p_code: normalizeCode(input.code)
  });

  if (error) {
    const message = error.message ?? "";

    if (message.includes("ACTIVATION_CODE_NOT_FOUND")) {
      throw new Error("激活码不存在");
    }

    if (message.includes("ACTIVATION_CODE_ALREADY_USED")) {
      throw new Error("激活码已经被使用");
    }

    if (message.includes("USER_NOT_FOUND")) {
      throw new Error("当前用户不存在，请重新登录后重试");
    }

    if (message.includes("ACTIVATION_CODE_EMPTY")) {
      throw new Error("激活码不能为空");
    }

    throw new Error(`激活码兑换失败：${message}`);
  }

  const row = Array.isArray(data)
    ? data[0]
    : data;

  if (!row) {
    throw new Error("激活码兑换失败：数据库没有返回结果");
  }

  const { error: ledgerError } = await client
    .from("quota_ledger_entries")
    .upsert(
      {
        user_id: input.userId,
        entry_kind: "activation_credit",
        amount: row.quota_amount as number,
        balance_recharge_after: row.recharge_quota as number,
        balance_subscription_after: 0,
        balance_frozen_after: row.frozen_quota as number,
        unique_event_key: `activation:${row.code as string}`,
        metadata: {
          note: `Redeemed activation code ${row.code as string}`
        }
      },
      {
        onConflict: "unique_event_key",
        ignoreDuplicates: true
      }
    );

  if (ledgerError) {
    throw new Error(`激活码兑换成功，但写入积分流水失败：${ledgerError.message}`);
  }

  return {
    code: row.code as string,
    tier: row.tier as ActivationCodeTier,
    quotaAmount: row.quota_amount as number,
    currentQuota: row.recharge_quota as number,
    frozenQuota: row.frozen_quota as number
  };
}

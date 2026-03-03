import { getPaymentLedgerEntries } from "@/src/lib/payments/repository";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import type {
  BillingHistoryEntry,
  QuotaLedgerKind
} from "@/src/types/billing";

type SupabaseLedgerRow = {
  id: string;
  entry_kind: string;
  amount: number;
  metadata: { note?: string } | null;
  created_at: string;
};

function describeLedgerKind(kind: QuotaLedgerKind) {
  switch (kind) {
    case "activation_credit":
      return {
        title: "激活码兑换",
        detail: "额度激活码兑换成功",
        multiplier: 1
      };
    case "recharge_credit":
      return {
        title: "额度充值",
        detail: "账户额度已充值到账",
        multiplier: 1
      };
    case "subscription_credit":
      return {
        title: "订阅额度发放",
        detail: "系统已发放本期订阅额度",
        multiplier: 1
      };
    case "task_freeze":
    case "task_settle":
      return {
        title: "生成文章",
        detail: "本次文章生成已扣除积分",
        multiplier: -1
      };
    case "task_release":
      return {
        title: "生成文章",
        detail: "文章任务未继续，积分已退回",
        multiplier: 1
      };
    case "humanize_freeze":
    case "humanize_settle":
      return {
        title: "自动降AI",
        detail: "本次自动降AI已扣除积分",
        multiplier: -1
      };
    case "humanize_release":
      return {
        title: "自动降AI",
        detail: "自动降AI未继续，积分已退回",
        multiplier: 1
      };
  }
}

export function mapLedgerEntryToHistory(input: {
  id: string;
  kind: QuotaLedgerKind;
  amount: number;
  createdAt: string;
  note?: string;
}): BillingHistoryEntry {
  const display = describeLedgerKind(input.kind);

  return {
    id: input.id,
    kind: input.kind,
    title: display.title,
    detail: input.note?.trim() || display.detail,
    amount: input.amount * display.multiplier,
    createdAt: input.createdAt
  };
}

export function getPaymentLedgerHistory(userId: string, limit = 8) {
  return getPaymentLedgerEntries(userId)
    .slice(0, limit)
    .map((entry) =>
      mapLedgerEntryToHistory({
        id: entry.ledgerKey,
        kind: entry.kind,
        amount: entry.amount,
        createdAt: entry.createdAt,
        note: entry.note
      })
    );
}

export async function getUserLedgerHistoryFromSupabase(userId: string, limit = 8) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("quota_ledger_entries")
    .select("id,entry_kind,amount,metadata,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`读取积分流水失败：${error.message}`);
  }

  return ((data ?? []) as SupabaseLedgerRow[]).map((entry) =>
    mapLedgerEntryToHistory({
      id: entry.id,
      kind: entry.entry_kind as QuotaLedgerKind,
      amount: entry.amount,
      createdAt: entry.created_at,
      note: entry.metadata?.note
    })
  );
}

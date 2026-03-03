import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

export type AdminFinanceSummaryRow = {
  label: string;
  value: string;
};

type AdminFinanceDependencies = {
  shouldUseSupabase?: () => boolean;
  createClient?: typeof createSupabaseAdminClient;
  now?: () => Date;
};

function getDayRange(now: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const dayString = formatter.format(now);

  return {
    start: `${dayString}T00:00:00+08:00`,
    end: `${dayString}T23:59:59.999+08:00`
  };
}

export async function getAdminFinanceSummary(
  dependencies: AdminFinanceDependencies = {}
): Promise<AdminFinanceSummaryRow[]> {
  const useSupabase =
    (dependencies.shouldUseSupabase ?? shouldUseSupabasePersistence)();

  if (!useSupabase) {
    return [
      { label: "今日发出的激活码", value: "0 个" },
      { label: "今日已兑换激活码", value: "0 个" },
      { label: "今日消耗额度", value: "0 点" }
    ];
  }

  const client = (dependencies.createClient ?? createSupabaseAdminClient)();
  const { start, end } = getDayRange((dependencies.now ?? (() => new Date()))());

  const [
    createdResult,
    redeemedResult,
    consumedResult
  ] = await Promise.all([
    client
      .from("activation_codes")
      .select("id", { count: "exact", head: true })
      .gte("created_at", start)
      .lte("created_at", end),
    client
      .from("activation_codes")
      .select("id", { count: "exact", head: true })
      .gte("used_at", start)
      .lte("used_at", end),
    client
      .from("quota_ledger_entries")
      .select("amount")
      .in("entry_kind", ["task_settle", "humanize_settle"])
      .gte("created_at", start)
      .lte("created_at", end)
  ]);

  if (createdResult.error) {
    throw new Error(`读取今日发码统计失败：${createdResult.error.message}`);
  }

  if (redeemedResult.error) {
    throw new Error(`读取今日兑换统计失败：${redeemedResult.error.message}`);
  }

  if (consumedResult.error) {
    throw new Error(`读取今日消耗统计失败：${consumedResult.error.message}`);
  }

  const consumedTotal = ((consumedResult.data ?? []) as Array<{ amount: number }>)
    .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);

  return [
    {
      label: "今日发出的激活码",
      value: `${createdResult.count ?? 0} 个`
    },
    {
      label: "今日已兑换激活码",
      value: `${redeemedResult.count ?? 0} 个`
    },
    {
      label: "今日消耗额度",
      value: `${consumedTotal} 点`
    }
  ];
}

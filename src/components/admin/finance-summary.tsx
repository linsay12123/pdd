import { WalletCards } from "lucide-react";
import {
  getAdminFinanceSummary,
  type AdminFinanceSummaryRow
} from "@/src/lib/admin/finance";

export function FinanceSummaryView({
  rows
}: {
  rows: AdminFinanceSummaryRow[];
}) {
  return (
    <section className="bg-brand-900/30 p-8 rounded-2xl border border-white/5">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-cream-50 flex items-center gap-2">
          <WalletCards className="w-5 h-5 text-gold-400" />
          财务总览
        </h2>
        <p className="text-sm text-brand-700 mt-2">
          这里显示今天的真实发码、真实兑换和真实积分消耗。
        </p>
      </div>

      <div className="grid gap-4">
        {rows.map((row) => (
          <div
            key={row.label}
            className="rounded-2xl border border-white/10 bg-brand-950/40 px-5 py-4 flex items-center justify-between gap-4"
          >
            <div className="text-sm text-brand-700">{row.label}</div>
            <div className="text-2xl font-bold text-gold-400 font-mono">
              {row.value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export async function FinanceSummary() {
  const rows = await getAdminFinanceSummary();

  return <FinanceSummaryView rows={rows} />;
}

import { Coins, ShieldCheck } from "lucide-react";
import {
  getAdminPricingRules,
  type AdminPricingRule
} from "@/src/lib/admin/pricing";

export function PricingEditorView({
  rules
}: {
  rules: AdminPricingRule[];
}) {
  return (
    <section className="bg-brand-900/30 p-8 rounded-2xl border border-white/5">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-cream-50 flex items-center gap-2">
            <Coins className="w-5 h-5 text-gold-400" />
            积分规则
          </h2>
          <p className="text-sm text-brand-700 mt-2 leading-6">
            这里显示当前线上真正生效的扣点规则。为了避免后台看起来能改、实际上又没生效，我先把这页改成真实展示版。
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-brand-950/50 px-4 py-3 text-right min-w-28">
          <div className="text-xs text-brand-700">当前规则数</div>
          <div className="text-2xl font-bold text-gold-400 font-mono">
            {rules.length}
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {rules.map((rule) => (
          <article
            key={rule.id}
            className="rounded-2xl border border-white/10 bg-brand-950/40 p-5 grid gap-4"
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-lg font-semibold text-cream-50">{rule.title}</div>
                <p className="text-sm text-brand-700 mt-2 leading-6">{rule.description}</p>
              </div>
              <div className="rounded-2xl border border-gold-400/20 bg-gold-400/10 px-4 py-3 text-right min-w-32">
                <div className="text-xs text-brand-700">当前固定扣点</div>
                <div className="text-2xl font-bold text-gold-400 font-mono">
                  {rule.quotaCost} 点
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-brand-900/60 px-4 py-3 text-sm text-brand-700 leading-6 flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-gold-400 mt-0.5 shrink-0" />
              <div>{rule.note}</div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function PricingEditor() {
  const rules = getAdminPricingRules();

  return <PricingEditorView rules={rules} />;
}

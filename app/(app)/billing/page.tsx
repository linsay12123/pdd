import { RechargeCard } from "@/src/components/billing/recharge-card";

export default function BillingPage() {
  const userId = "demo-user";

  return (
    <section className="pdd-list" style={{ gap: "16px" }}>
      <header className="pdd-card" style={{ padding: "22px" }}>
        <p style={{ marginTop: 0, marginBottom: "8px", color: "#64748b", fontWeight: 700 }}>拼代代PDD</p>
        <h1 className="pdd-heading" style={{ margin: 0, fontSize: "2rem" }}>
          额度激活码中心
        </h1>
        <p className="pdd-sub">
          这里只保留激活码充值模式。用户登录后输入一次性激活码即可加积分，不再展示任何在线支付方式。
        </p>
      </header>
      <RechargeCard currentQuota={12000} userId={userId} />
    </section>
  );
}

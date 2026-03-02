import { RechargeCard } from "@/src/components/billing/recharge-card";

export default function BillingPage() {
  const userId = "demo-user";

  return (
    <section style={{ display: "grid", gap: "20px" }}>
      <header
        style={{
          padding: "24px",
          borderRadius: "20px",
          border: "1px solid rgba(117, 96, 57, 0.14)",
          background: "linear-gradient(135deg, #fff7e7, #f3e6ca)",
          boxShadow: "0 20px 40px rgba(54, 45, 28, 0.08)"
        }}
      >
        <p style={{ marginTop: 0, marginBottom: "8px", color: "#6b5732" }}>拼代代PDD</p>
        <h1 style={{ marginTop: 0, marginBottom: "8px" }}>额度激活码中心</h1>
        <p style={{ margin: 0, lineHeight: 1.7 }}>
          这里不再展示任何在线支付。用户登录后，直接输入一次性激活码给账户充值积分。
        </p>
      </header>
      <RechargeCard currentQuota={12000} userId={userId} />
    </section>
  );
}

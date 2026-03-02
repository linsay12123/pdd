import { RechargeCard } from "@/src/components/billing/recharge-card";

export default function BillingPage() {
  return (
    <section style={{ display: "grid", gap: "20px" }}>
      <header
        style={{
          padding: "20px",
          borderRadius: "18px",
          border: "1px solid #d7cfbe",
          background: "linear-gradient(135deg, #fff7e7, #f2e7ce)"
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: "8px" }}>充值中心</h1>
        <p style={{ margin: 0 }}>
          这里会统一处理充值包、月订阅和不同支付方式。当前先把 Stripe
          这条主通道接起来。
        </p>
      </header>
      <RechargeCard currentQuota={120} monthlyQuota={80} />
    </section>
  );
}

import {
  rechargePackages,
  subscriptionPackages,
  supportedCryptoAssets,
  supportedCryptoNetworks
} from "@/src/lib/payments/catalog";

type RechargeCardProps = {
  currentQuota: number;
  monthlyQuota: number;
};

function cardStyle(background: string) {
  return {
    padding: "16px",
    borderRadius: "16px",
    border: "1px solid #d7cfbe",
    background
  } as const;
}

export function RechargeCard({
  currentQuota,
  monthlyQuota
}: RechargeCardProps) {
  return (
    <section style={{ display: "grid", gap: "16px" }}>
      <section style={cardStyle("#fffaf1")}>
        <h2 style={{ marginTop: 0 }}>当前额度</h2>
        <p style={{ margin: "8px 0" }}>充值额度：{currentQuota} 点</p>
        <p style={{ margin: "8px 0" }}>本月订阅额度：{monthlyQuota} 点</p>
        <p style={{ margin: "8px 0 0", color: "#5a4d34" }}>
          订阅额度月底清零，充值额度会一直保留。
        </p>
      </section>

      <section style={cardStyle("#ffffff")}>
        <h2 style={{ marginTop: 0 }}>充值包</h2>
        <div style={{ display: "grid", gap: "12px" }}>
          {rechargePackages.map((pkg) => (
            <article
              key={pkg.id}
              style={{
                padding: "14px",
                borderRadius: "14px",
                border: "1px solid #e3d8c2",
                background: "#f9f4ea"
              }}
            >
              <strong>{pkg.title}</strong>
              <div style={{ marginTop: "6px" }}>
                {pkg.quotaAmount} 点额度 / ${pkg.amountUsd}
              </div>
              <p style={{ marginBottom: "10px" }}>{pkg.description}</p>
              <p style={{ marginTop: 0, marginBottom: "10px", color: "#5a4d34" }}>
                加密货币支持：{supportedCryptoAssets.join(" / ")}，链路支持：
                {supportedCryptoNetworks.join(" / ")}
              </p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button type="button">Stripe</button>
                <button type="button">USDT / USDC（多链）</button>
                <button type="button">支付宝</button>
                <button type="button">微信支付</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section style={cardStyle("#f5efe2")}>
        <h2 style={{ marginTop: 0 }}>月订阅</h2>
        <div style={{ display: "grid", gap: "12px" }}>
          {subscriptionPackages.map((pkg) => (
            <article
              key={pkg.id}
              style={{
                padding: "14px",
                borderRadius: "14px",
                border: "1px solid #d9cdb5",
                background: "#fffdf8"
              }}
            >
              <strong>{pkg.title}</strong>
              <div style={{ marginTop: "6px" }}>
                每月 {pkg.monthlyQuota} 点 / ${pkg.amountUsd}
              </div>
              <p style={{ marginBottom: "10px" }}>{pkg.description}</p>
              <button type="button">Stripe 订阅</button>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

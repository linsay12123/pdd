import { pricingRows } from "@/src/lib/admin/mock-data";

export function PricingEditor() {
  return (
    <section
      style={{
        padding: "18px",
        borderRadius: "18px",
        border: "1px solid #d7cfbe",
        background: "#ffffff"
      }}
    >
      <h2 style={{ marginTop: 0 }}>价格策略</h2>
      <div style={{ display: "grid", gap: "10px" }}>
        {pricingRows.map((row) => (
          <div
            key={row.label}
            style={{
              padding: "12px",
              borderRadius: "12px",
              background: "#f7f0e2",
              display: "grid",
              gap: "6px"
            }}
          >
            <strong>{row.label}</strong>
            <div style={{ fontSize: "13px", color: "#5a4d34" }}>
              当前消耗：{row.quota} 点 | 支付方式：{row.paymentMethod}
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button type="button">修改价格</button>
              <button type="button">停用支付方式</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

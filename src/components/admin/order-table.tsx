import { adminOrders } from "@/src/lib/admin/mock-data";

export function OrderTable() {
  return (
    <section
      style={{
        padding: "18px",
        borderRadius: "18px",
        border: "1px solid #d7cfbe",
        background: "#ffffff"
      }}
    >
      <h2 style={{ marginTop: 0 }}>订单管理</h2>
      <div style={{ display: "grid", gap: "10px" }}>
        {adminOrders.map((order) => (
          <div
            key={order.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1fr 1fr 1fr",
              gap: "8px",
              padding: "12px",
              borderRadius: "12px",
              background: "#f8f3e8"
            }}
          >
            <span>{order.id}</span>
            <span>{order.provider}</span>
            <span>{order.amount}</span>
            <span>{order.status}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

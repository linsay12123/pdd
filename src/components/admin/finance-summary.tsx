import { financeRows } from "@/src/lib/admin/mock-data";

export function FinanceSummary() {
  return (
    <section
      style={{
        padding: "18px",
        borderRadius: "18px",
        border: "1px solid #d7cfbe",
        background: "#fffdf8"
      }}
    >
      <h2 style={{ marginTop: 0 }}>财务总览</h2>
      <div style={{ display: "grid", gap: "10px" }}>
        {financeRows.map((row) => (
          <div
            key={row.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "12px",
              borderRadius: "12px",
              background: "#ffffff",
              border: "1px solid #e3d8c2"
            }}
          >
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

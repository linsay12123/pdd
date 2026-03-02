import { adminUsers } from "@/src/lib/admin/mock-data";

export function UserTable() {
  return (
    <section
      style={{
        padding: "18px",
        borderRadius: "18px",
        border: "1px solid #d7cfbe",
        background: "#fffaf1"
      }}
    >
      <h2 style={{ marginTop: 0 }}>用户管理</h2>
      <div style={{ display: "grid", gap: "12px" }}>
        {adminUsers.map((user) => (
          <article
            key={user.id}
            style={{
              display: "grid",
              gap: "8px",
              padding: "14px",
              borderRadius: "14px",
              background: "#ffffff",
              border: "1px solid #e3d8c2"
            }}
          >
            <div>
              <strong>{user.email}</strong>
              <div style={{ fontSize: "13px", color: "#5a4d34" }}>
                状态：{user.status} | 当前积分：{user.currentQuota}
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button type="button">冻结用户</button>
              <button type="button">解冻用户</button>
              <button type="button">手动加积分</button>
              <button type="button">手动扣积分</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

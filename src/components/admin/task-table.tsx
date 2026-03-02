import { adminTasks } from "@/src/lib/admin/mock-data";

export function TaskTable() {
  return (
    <section
      style={{
        padding: "18px",
        borderRadius: "18px",
        border: "1px solid #d7cfbe",
        background: "#fffdf8"
      }}
    >
      <h2 style={{ marginTop: 0 }}>任务管理</h2>
      <div style={{ display: "grid", gap: "12px" }}>
        {adminTasks.map((task) => (
          <article
            key={task.id}
            style={{
              padding: "14px",
              borderRadius: "14px",
              border: "1px solid #e3d8c2",
              background: "#ffffff",
              display: "grid",
              gap: "8px"
            }}
          >
            <div>
              <strong>{task.id}</strong>
              <div style={{ fontSize: "13px", color: "#5a4d34" }}>
                {task.userEmail} | {task.status} | 到期：{task.expiresAt}
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button type="button">重试任务</button>
              <button type="button">延长保留</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

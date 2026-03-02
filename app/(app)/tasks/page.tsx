export default function TasksPage() {
  const taskRows = [
    {
      id: "TASK-20260302-001",
      title: "商科课程分析长文",
      status: "已完成",
      points: "-500",
      action: "下载正文 / 报告"
    },
    {
      id: "TASK-20260302-002",
      title: "教育学论文终稿 + 自动降AI",
      status: "已完成",
      points: "-1000",
      action: "下载正文 / 报告 / 降AI后版本"
    },
    {
      id: "TASK-20260301-019",
      title: "研究综述任务",
      status: "处理失败",
      points: "0",
      action: "重新处理"
    }
  ];

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
        <h1 style={{ marginTop: 0, marginBottom: "8px" }}>我的任务</h1>
        <p style={{ margin: 0, lineHeight: 1.7 }}>
          这里集中看最近任务、当前状态、积分消耗和交付入口。失败任务也会保留“重新处理”提示。
        </p>
      </header>

      <section
        style={{
          borderRadius: "20px",
          border: "1px solid rgba(117, 96, 57, 0.14)",
          background: "rgba(255, 255, 255, 0.9)",
          overflow: "hidden",
          boxShadow: "0 20px 40px rgba(54, 45, 28, 0.08)"
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(220px, 1.8fr) minmax(120px, 0.7fr) minmax(120px, 0.7fr) minmax(220px, 1.2fr)",
            gap: "12px",
            padding: "16px 20px",
            background: "#f8f2e6",
            fontWeight: 700
          }}
        >
          <span>任务信息</span>
          <span>状态</span>
          <span>积分消耗</span>
          <span>操作</span>
        </div>

        <div style={{ display: "grid" }}>
          {taskRows.map((task, index) => (
            <article
              key={task.id}
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(220px, 1.8fr) minmax(120px, 0.7fr) minmax(120px, 0.7fr) minmax(220px, 1.2fr)",
                gap: "12px",
                padding: "16px 20px",
                borderTop: index === 0 ? "none" : "1px solid rgba(117, 96, 57, 0.08)",
                alignItems: "center"
              }}
            >
              <div style={{ display: "grid", gap: "4px" }}>
                <strong>{task.title}</strong>
                <span style={{ fontSize: "0.85rem", color: "#6d624f" }}>{task.id}</span>
              </div>
              <span>{task.status}</span>
              <span>{task.points}</span>
              <span>{task.action}</span>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

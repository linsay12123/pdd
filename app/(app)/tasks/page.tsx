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
    <section className="pdd-list" style={{ gap: "16px" }}>
      <header className="pdd-card" style={{ padding: "22px" }}>
        <p style={{ marginTop: 0, marginBottom: "8px", color: "#64748b", fontWeight: 700 }}>拼代代PDD</p>
        <h1 className="pdd-heading" style={{ margin: 0, fontSize: "2rem" }}>
          我的任务
        </h1>
        <p className="pdd-sub">
          这里集中看任务状态、积分消耗和下载入口，失败任务也会保留“重新处理”按钮。
        </p>
      </header>

      <section className="pdd-card" style={{ overflow: "hidden" }}>
        <table className="pdd-table">
          <thead>
            <tr>
              <th>任务信息</th>
              <th>状态</th>
              <th>积分消耗</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {taskRows.map((task) => (
              <tr key={task.id}>
                <td>
                  <strong>{task.title}</strong>
                  <div style={{ color: "#64748b", marginTop: "4px", fontSize: "12px" }}>{task.id}</div>
                </td>
                <td>{task.status}</td>
                <td className="pdd-mono">{task.points}</td>
                <td>{task.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </section>
  );
}

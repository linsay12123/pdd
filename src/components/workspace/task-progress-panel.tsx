const progressSteps = [
  "正在读取文件",
  "等待确认主任务文件",
  "正在生成大纲",
  "等待确认大纲",
  "正在写正文",
  "正在校正字数",
  "正在核验引用",
  "正在生成文件"
];

export function TaskProgressPanel() {
  return (
    <section className="pdd-card" style={{ padding: "18px" }}>
      <h2 style={{ marginTop: 0, marginBottom: "8px" }}>当前进度</h2>
      <ul style={{ margin: 0, paddingLeft: "18px", display: "grid", gap: "7px" }}>
        {progressSteps.map((step, index) => (
          <li key={step} style={{ color: index < 2 ? "#0f172a" : "#64748b" }}>
            {step}
          </li>
        ))}
      </ul>
    </section>
  );
}

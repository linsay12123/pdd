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
    <section
      style={{
        padding: "20px",
        border: "1px solid #d7cfbe",
        borderRadius: "16px",
        background: "rgba(255, 255, 255, 0.82)"
      }}
    >
      <h2 style={{ marginTop: 0 }}>当前进度</h2>
      <ul style={{ margin: 0, paddingLeft: "20px", display: "grid", gap: "8px" }}>
        {progressSteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ul>
    </section>
  );
}

export function OutlineReviewPanel() {
  return (
    <section
      style={{
        padding: "20px",
        border: "1px solid #d7cfbe",
        borderRadius: "16px",
        background: "#fffdf8"
      }}
    >
      <h2 style={{ marginTop: 0 }}>英文大纲</h2>
      <p style={{ marginTop: 0 }}>这里会先显示英文主版大纲，再尽量显示中文对照。</p>
      <div style={{ display: "grid", gap: "8px" }}>
        <div>目标字数：2000</div>
        <div>引用格式：APA 7</div>
        <div>用户修改意见输入区（占位）</div>
      </div>
    </section>
  );
}

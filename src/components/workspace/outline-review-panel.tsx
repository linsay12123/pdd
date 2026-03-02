export function OutlineReviewPanel() {
  return (
    <section className="pdd-card" style={{ padding: "18px" }}>
      <h2 style={{ marginTop: 0, marginBottom: "8px" }}>英文大纲</h2>
      <p className="pdd-sub">先显示英文主版，再给中文对照。你确认后才会继续写正文。</p>
      <div className="pdd-card-plain" style={{ padding: "12px", marginTop: "10px" }}>
        <div>目标字数：2000</div>
        <div>引用格式：APA 7</div>
        <div style={{ marginTop: "6px", color: "#64748b" }}>文章标题 + 章节 + 每章重点（占位）</div>
      </div>
      <textarea
        className="pdd-textarea"
        placeholder="输入你的修改意见，例如：第三章加一个行业案例。"
        style={{ marginTop: "10px" }}
      />
    </section>
  );
}

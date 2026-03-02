export function SpecialRequirementsField() {
  return (
    <section className="pdd-card" style={{ padding: "18px" }}>
      <h2 style={{ marginTop: 0, marginBottom: "8px" }}>特殊要求</h2>
      <p className="pdd-sub">
        这里填写行业方向、课程重点、分析偏好。第一版大纲就会使用这些要求，不会拖到后面才生效。
      </p>
      <textarea
        className="pdd-textarea"
        placeholder="例如：重点比较两种理论，引用近五年文献，突出批判性分析。"
        style={{ marginTop: "12px" }}
      />
    </section>
  );
}

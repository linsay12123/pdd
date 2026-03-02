export function UploadDropzone() {
  return (
    <section className="pdd-card" style={{ padding: "18px" }}>
      <h2 style={{ marginTop: 0, marginBottom: "8px" }}>上传任务文件</h2>
      <p className="pdd-sub">
        支持 txt、md、docx、pdf、ppt、pptx。系统会读取文件内容，不只看文件名。
      </p>
      <label
        className="pdd-card-plain"
        style={{
          marginTop: "12px",
          padding: "20px",
          borderStyle: "dashed",
          display: "grid",
          gap: "6px",
          cursor: "pointer",
          textAlign: "center"
        }}
      >
        <strong>点击选择或拖拽上传多个文件</strong>
        <span style={{ color: "#64748b", fontSize: "13px" }}>上传后会自动做任务要求识别与材料分类</span>
        <input type="file" multiple style={{ display: "none" }} />
      </label>
    </section>
  );
}

export function UploadDropzone() {
  return (
    <section
      style={{
        padding: "20px",
        border: "1px dashed #bda97c",
        borderRadius: "16px",
        background: "#fffaf2"
      }}
    >
      <h2 style={{ marginTop: 0 }}>上传任务文件</h2>
      <p style={{ marginBottom: 0 }}>
        支持 txt、md、docx、pdf、ppt、pptx。后面这里会接上真实拖拽上传和多文件选择。
      </p>
    </section>
  );
}

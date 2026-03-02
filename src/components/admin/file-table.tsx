import { adminFiles } from "@/src/lib/admin/mock-data";

export function FileTable() {
  return (
    <section
      style={{
        padding: "18px",
        borderRadius: "18px",
        border: "1px solid #d7cfbe",
        background: "#fffaf1"
      }}
    >
      <h2 style={{ marginTop: 0 }}>文件管理</h2>
      <div style={{ display: "grid", gap: "10px" }}>
        {adminFiles.map((file) => (
          <div
            key={file.id}
            style={{
              padding: "12px",
              borderRadius: "12px",
              background: "#ffffff",
              border: "1px solid #e3d8c2"
            }}
          >
            <strong>{file.kind}</strong>
            <div style={{ fontSize: "13px", color: "#5a4d34" }}>
              {file.id} | 任务：{file.taskId} | 状态：{file.status} | 到期：
              {file.expiresAt}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

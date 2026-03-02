import { DeliverablesPanel } from "@/src/components/workspace/deliverables-panel";
import { OutlineReviewPanel } from "@/src/components/workspace/outline-review-panel";
import { SpecialRequirementsField } from "@/src/components/workspace/special-requirements-field";
import { TaskProgressPanel } from "@/src/components/workspace/task-progress-panel";
import { UploadDropzone } from "@/src/components/workspace/upload-dropzone";

export default function WorkspacePage() {
  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <header
        style={{
          padding: "20px",
          borderRadius: "20px",
          background:
            "linear-gradient(135deg, rgba(77, 53, 25, 0.92), rgba(143, 112, 58, 0.9))",
          color: "#fff7e8"
        }}
      >
        <p style={{ margin: 0, fontSize: "12px", letterSpacing: "0.08em" }}>
          单页面写作工作台
        </p>
        <h1 style={{ marginTop: "8px", marginBottom: "8px" }}>开始写作</h1>
        <p style={{ margin: 0 }}>
          用户会在同一个页面里完成上传、等待、大纲确认、写作和下载。
        </p>
      </header>
      <UploadDropzone />
      <SpecialRequirementsField />
      <section
        style={{
          padding: "20px",
          borderRadius: "16px",
          background: "#f6efe0",
          border: "1px solid #d7cfbe"
        }}
      >
        <strong>预计消耗额度</strong>
        <div style={{ marginTop: "8px" }}>文章生成 0 点 | 自动降 AI 另算</div>
      </section>
      <TaskProgressPanel />
      <OutlineReviewPanel />
      <DeliverablesPanel />
    </div>
  );
}

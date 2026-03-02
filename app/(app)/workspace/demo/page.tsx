import { DeliverablesPanel } from "@/src/components/workspace/deliverables-panel";
import { OutlineReviewPanel } from "@/src/components/workspace/outline-review-panel";
import { SpecialRequirementsField } from "@/src/components/workspace/special-requirements-field";
import { TaskProgressPanel } from "@/src/components/workspace/task-progress-panel";
import { UploadDropzone } from "@/src/components/workspace/upload-dropzone";

export default function WorkspaceDemoPage() {
  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <header
        style={{
          padding: "20px",
          borderRadius: "20px",
          background:
            "linear-gradient(135deg, rgba(30, 54, 89, 0.94), rgba(74, 122, 191, 0.88))",
          color: "#eef5ff"
        }}
      >
        <p style={{ margin: 0, fontSize: "12px", letterSpacing: "0.08em" }}>
          上线前验收预览
        </p>
        <h1 style={{ marginTop: "8px", marginBottom: "8px" }}>完整流程演示</h1>
        <p style={{ margin: 0 }}>
          这里用于快速检查上传、大纲、交付下载和降 AI 入口是否都已经显示正常。
        </p>
      </header>
      <UploadDropzone />
      <SpecialRequirementsField />
      <section
        style={{
          padding: "20px",
          borderRadius: "16px",
          background: "#ebf3ff",
          border: "1px solid #b7c9ea"
        }}
      >
        <strong>验收状态</strong>
        <div style={{ marginTop: "8px" }}>
          已模拟完成上传、确认大纲、生成交付件和降 AI 后版本。
        </div>
      </section>
      <TaskProgressPanel />
      <OutlineReviewPanel />
      <DeliverablesPanel
        finalDocxHref="/downloads/demo-final.docx"
        referenceReportHref="/downloads/demo-report.pdf"
        humanizedDocxHref="/downloads/demo-humanized.docx"
      />
    </div>
  );
}

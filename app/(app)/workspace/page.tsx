import Link from "next/link";
import { BrandLogo } from "@/src/components/brand/brand-logo";
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
          padding: "24px",
          borderRadius: "24px",
          background:
            "linear-gradient(135deg, rgba(33, 28, 21, 0.95), rgba(103, 79, 42, 0.9))",
          color: "#fff7e8",
          boxShadow: "0 24px 48px rgba(39, 32, 21, 0.18)"
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <div style={{ display: "grid", gap: "10px" }}>
            <BrandLogo />
            <p style={{ margin: 0, fontSize: "12px", letterSpacing: "0.08em", color: "#f1ddb2" }}>
              单页面写作工作台
            </p>
            <h1 style={{ margin: 0 }}>开始写作</h1>
            <p style={{ margin: 0, lineHeight: 1.7, maxWidth: "760px" }}>
              用户会在同一个页面里完成上传、等待、大纲确认、写作和下载。整个流程尽量不跳页，减少来回折腾。
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gap: "10px",
              minWidth: "260px",
              padding: "16px",
              borderRadius: "18px",
              background: "rgba(255, 247, 232, 0.08)",
              border: "1px solid rgba(255, 234, 191, 0.12)"
            }}
          >
            <strong>当前积分：12000 点</strong>
            <span>生成文章固定扣 500 积分</span>
            <span>自动降AI固定扣 500 积分</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "4px" }}>
              <Link href="/recharge" style={{ color: "#fff7e8" }}>
                去额度中心
              </Link>
              <Link href="/tasks" style={{ color: "#fff7e8" }}>
                查看我的任务
              </Link>
            </div>
          </div>
        </div>
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
        <div style={{ marginTop: "8px" }}>生成文章固定扣 500 积分 | 自动降AI固定扣 500 积分</div>
      </section>
      <TaskProgressPanel />
      <OutlineReviewPanel />
      <DeliverablesPanel />
    </div>
  );
}

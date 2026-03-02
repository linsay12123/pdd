import Link from "next/link";
import { BrandLogo } from "@/src/components/brand/brand-logo";
import { DeliverablesPanel } from "@/src/components/workspace/deliverables-panel";
import { OutlineReviewPanel } from "@/src/components/workspace/outline-review-panel";
import { SpecialRequirementsField } from "@/src/components/workspace/special-requirements-field";
import { TaskProgressPanel } from "@/src/components/workspace/task-progress-panel";
import { UploadDropzone } from "@/src/components/workspace/upload-dropzone";

export default function WorkspacePage() {
  return (
    <section className="pdd-list" style={{ gap: "18px" }}>
      <header className="pdd-card" style={{ padding: "22px" }}>
        <div className="pdd-grid-2" style={{ alignItems: "center" }}>
          <div className="pdd-list" style={{ gap: "8px" }}>
            <BrandLogo />
            <span className="pdd-tag">单页面写作工作台</span>
            <h1 className="pdd-heading" style={{ fontSize: "2rem", margin: 0 }}>
              开始写作
            </h1>
            <p className="pdd-sub">
              上传任务文件后，系统会先分析要求，再生成英文大纲。你确认大纲后，才会开始正文生成与交付。
            </p>
          </div>

          <div className="pdd-card-plain" style={{ padding: "14px", background: "#fff7ed" }}>
            <strong>当前积分：12000 点</strong>
            <div style={{ marginTop: "6px", color: "#475569", lineHeight: 1.7 }}>
              <div>生成文章固定扣 500 积分</div>
              <div>自动降AI固定扣 500 积分</div>
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "8px" }}>
              <Link href="/recharge">去额度中心</Link>
              <Link href="/tasks">查看我的任务</Link>
            </div>
          </div>
        </div>
      </header>

      <div className="pdd-grid-2">
        <div className="pdd-list" style={{ gap: "14px" }}>
          <UploadDropzone />
          <SpecialRequirementsField />
          <section className="pdd-card-plain" style={{ padding: "14px" }}>
            <strong>预计消耗额度</strong>
            <div style={{ marginTop: "6px", color: "#475569" }}>
              生成文章固定扣 500 积分 | 自动降AI固定扣 500 积分
            </div>
          </section>
        </div>
        <div className="pdd-list" style={{ gap: "14px" }}>
          <TaskProgressPanel />
          <OutlineReviewPanel />
        </div>
      </div>

      <DeliverablesPanel />
    </section>
  );
}

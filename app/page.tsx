import Link from "next/link";
import { BrandLogo } from "@/src/components/brand/brand-logo";
import { ContactSalesCard } from "@/src/components/brand/contact-sales-card";

const trustTags = [
  "同页完成全流程",
  "先看大纲再写正文",
  "多文件任务分析",
  "支持引用核验报告",
  "自动降AI + 人工协助",
  "激活码规则透明"
];

const features = [
  {
    title: "多文件上传分析",
    detail: "支持 txt、md、docx、pdf、ppt、pptx，一次上传后系统自动提取核心信息。"
  },
  {
    title: "大纲先确认",
    detail: "先生成英文大纲，用户可多轮修改，确认后才进入正文生成。"
  },
  {
    title: "正文 + 引用核验",
    detail: "交付 Word 正文和 PDF 核验报告，正文引用与参考文献对应展示。"
  },
  {
    title: "自动降AI",
    detail: "交付时可继续点自动降AI，生成降AI后版本（Word）。"
  },
  {
    title: "人工服务入口",
    detail: "降AI后版本旁边保留客服二维码，便于人工深度处理。"
  },
  {
    title: "额度激活码机制",
    detail: "不走在线支付，用户登录后输入一次性激活码即可到账积分。"
  }
];

const cases = [
  "商科分析作业：评分标准 + 课程要求 + 案例材料同时上传，首版大纲即可对齐。",
  "教育学论文：先确认章节结构后再写正文，返工率明显下降。",
  "工作室批量接单：同一流程快速处理多份任务，交付口径统一。",
  "研究综述长文：系统优先识别硬性要求，避免把背景数字误判为目标字数。"
];

const faqs = [
  "支持哪些文件类型？支持 txt、md、docx、pdf、ppt、pptx。",
  "会不会先写正文？不会，必须先给用户看英文大纲并等待确认。",
  "怎么充值？登录后用额度激活码充值，不走在线付款。",
  "扣费规则是什么？生成文章固定扣 500 积分，自动降AI固定扣 500 积分。"
];

export default function HomePage() {
  return (
    <main>
      <header className="pdd-topbar">
        <div className="pdd-container pdd-topbar-inner">
          <BrandLogo />
          <nav className="pdd-nav">
            <a href="#features">功能介绍</a>
            <a href="#cases">成功案例</a>
            <a href="#faq">常见问题</a>
            <Link href="/login">登录</Link>
            <Link href="/recharge">激活额度</Link>
          </nav>
        </div>
      </header>

      <section className="pdd-hero">
        <div className="pdd-container pdd-grid-2">
          <article className="pdd-card" style={{ padding: "28px" }}>
            <span className="pdd-tag">专为接单工作室与学生用户设计</span>
            <h1 className="pdd-heading" style={{ marginTop: "14px" }}>
              批量处理，稳定交付。
              <br />
              把写作流程做成可复用的成品。
            </h1>
            <p className="pdd-sub">
              上传任务材料后，系统先分析要求，再给英文大纲。用户确认后才写正文，最后交付
              Word 与引用核验报告。
            </p>
            <div className="pdd-list" style={{ marginTop: "16px" }}>
              <div>生成文章固定扣 500 积分</div>
              <div>自动降AI固定扣 500 积分</div>
              <div>登录后输入激活码充值，不走在线付款</div>
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "20px" }}>
              <Link className="pdd-btn pdd-btn-primary" href="/login">
                立即登录工作台
              </Link>
              <a className="pdd-btn pdd-btn-secondary" href="#contact-sales">
                联系客服购买额度
              </a>
            </div>
          </article>

          <aside className="pdd-card" style={{ padding: "24px" }}>
            <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.25rem" }}>文章生产工作流程</h2>
            <div className="pdd-list">
              <div className="pdd-card-plain" style={{ padding: "14px" }}>
                <strong>1. 任务分析</strong>
                <p className="pdd-sub">提取硬性要求、目标字数、引用格式，并识别任务文件与背景材料。</p>
              </div>
              <div className="pdd-card-plain" style={{ padding: "14px" }}>
                <strong>2. 英文大纲确认</strong>
                <p className="pdd-sub">先看文章标题和章节重点，可修改，满意后继续。</p>
              </div>
              <div className="pdd-card-plain" style={{ padding: "14px" }}>
                <strong>3. 交付与扩展</strong>
                <p className="pdd-sub">交付 Word + 核验报告；可继续自动降AI并下载降AI后版本。</p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section style={{ paddingBottom: "28px" }}>
        <div className="pdd-container pdd-card" style={{ padding: "14px" }}>
          <div className="pdd-grid-4">
            {trustTags.map((item) => (
              <div
                key={item}
                className="pdd-card-plain"
                style={{ padding: "10px 12px", textAlign: "center", fontWeight: 600 }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pdd-section" id="features">
        <div className="pdd-container">
          <div style={{ textAlign: "center", marginBottom: "20px" }}>
            <h2 className="pdd-heading">核心功能矩阵</h2>
            <p className="pdd-sub">不是单纯“生成文字”，而是完整交付链路。</p>
          </div>
          <div className="pdd-grid-3">
            {features.map((item) => (
              <article key={item.title} className="pdd-card" style={{ padding: "20px" }}>
                <h3 style={{ marginTop: 0, marginBottom: "8px" }}>{item.title}</h3>
                <p className="pdd-sub">{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="pdd-section pdd-dark" id="cases">
        <div className="pdd-container">
          <h2 className="pdd-heading" style={{ marginBottom: "8px" }}>
            成功案例展示
          </h2>
          <p className="pdd-sub" style={{ marginBottom: "20px" }}>
            以下是典型场景示例，帮助用户判断这个系统是否适合自己。
          </p>
          <div className="pdd-grid-2">
            {cases.map((item) => (
              <div key={item} className="pdd-card-plain" style={{ padding: "16px", color: "#1f2937" }}>
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pdd-section">
        <div className="pdd-container pdd-card" style={{ padding: "26px" }}>
          <h2 className="pdd-heading" style={{ marginBottom: "8px" }}>
            额度激活码规则
          </h2>
          <p className="pdd-sub">
            账号长期可登录，充值通过激活码完成。每个激活码只能用一次，但同一账号可以反复兑换不同激活码。
          </p>
          <div className="pdd-grid-4" style={{ marginTop: "14px" }}>
            {["1000 积分", "5000 积分", "10000 积分", "20000 积分"].map((item) => (
              <div
                key={item}
                className="pdd-card-plain"
                style={{ padding: "12px", textAlign: "center", fontWeight: 800 }}
              >
                {item}
              </div>
            ))}
          </div>
          <div style={{ marginTop: "14px" }}>
            <Link className="pdd-btn pdd-btn-primary" href="/recharge">
              去额度中心输入激活码
            </Link>
          </div>
        </div>
      </section>

      <section className="pdd-section" id="contact-sales">
        <div className="pdd-container">
          <ContactSalesCard />
        </div>
      </section>

      <section className="pdd-section" id="faq" style={{ paddingTop: 0 }}>
        <div className="pdd-container pdd-card" style={{ padding: "24px" }}>
          <h2 className="pdd-heading" style={{ marginBottom: "12px" }}>
            常见问题
          </h2>
          <div className="pdd-list">
            {faqs.map((item, index) => (
              <div key={item} className="pdd-card-plain" style={{ padding: "12px 14px" }}>
                <strong>Q{index + 1}：</strong>
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

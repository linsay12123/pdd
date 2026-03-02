import Link from "next/link";
import { BrandLogo } from "../src/components/brand/brand-logo";
import { ContactSalesCard } from "../src/components/brand/contact-sales-card";

const trustHighlights = [
  "同页完成全流程",
  "先看大纲再写正文",
  "多文件任务分析",
  "支持引用核验报告",
  "自动降AI + 人工协助",
  "激活码规则清楚透明"
];

const audienceCards = [
  {
    title: "接单个人",
    pain: "客户要求杂、返工多、自己一个人很难同时盯住多个单子。",
    value: "先给客户看大纲，再决定正文方向，能大幅减少返工。"
  },
  {
    title: "小型工作室",
    pain: "不同写手水平不稳，交付标准难统一，利润经常被返工吃掉。",
    value: "把上传、分析、大纲、正文、核验、降AI统一成固定流程，更容易做批量交付。"
  },
  {
    title: "学生个人",
    pain: "不会搭结构，怕工具不靠谱，担心看起来像机器写的。",
    value: "流程透明，先看大纲，确认后再写，最后还能继续自动降AI。"
  }
];

const processSteps = [
  "登录账号",
  "输入额度激活码",
  "上传多个任务文件",
  "系统分析要求与参考材料",
  "先生成英文大纲",
  "确认后生成完整正文",
  "导出 Word 与核验报告",
  "按需继续自动降AI"
];

const featureCards = [
  "多文件上传分析",
  "自动提取字数与引用格式",
  "英文大纲先确认",
  "完整英文正文生成",
  "引用核验报告输出",
  "自动降AI与人工客服协助"
];

const caseCards = [
  {
    title: "案例 A：商科分析作业",
    summary: "客户给了课程要求、评分标准和两份行业背景材料。系统先抽出重点，再按目标字数生成结构清楚的英文大纲。"
  },
  {
    title: "案例 B：教育学课程论文",
    summary: "用户最怕返工，所以先拿大纲和老师要求对齐，确认以后再生成正文，交付更稳。"
  },
  {
    title: "案例 C：工作室批量处理",
    summary: "同一天处理多份任务时，用统一流程能明显提速，也更方便团队分配。"
  },
  {
    title: "案例 D：研究综述长文",
    summary: "多篇参考文件同时上传，系统优先识别硬性要求，再整理出适合长文的章节结构。"
  },
  {
    title: "案例 E：行业分析型文章",
    summary: "用户额外填了特殊要求，系统在第一版大纲里就带上了行业角度，没有拖到后面才处理。"
  },
  {
    title: "案例 F：需要降AI的终稿",
    summary: "文章生成完成后，再走自动降AI流程，输出新的 Word 版本，并继续保留人工客服入口。"
  }
];

const feedbackCards = [
  "接单用户：先给客户看大纲以后，返工少了很多。",
  "工作室成员：流程统一以后，新人也更容易跟上节奏。",
  "学生用户：能先确认结构，我心里更有底。",
  "高频用户：多文件一起传，比我自己整理省事太多。",
  "课程辅导场景：目标字数和引用格式会先说明，沟通成本低很多。",
  "教育团队：交付物清楚，拿去发客户更像正式产品。",
  "长期用户：激活码充值很直接，不用折腾在线付款。",
  "售后角度：有客服二维码放在页面里，出问题能马上找到人。"
];

const serviceStandards = [
  "规则透明",
  "先大纲后正文",
  "交付物明确",
  "引用核验输出",
  "固定积分消耗",
  "支持反复充值",
  "客服可直接联系",
  "适合长期使用"
];

const faqItems = [
  "支持 txt、md、docx、pdf、ppt、pptx 等常见文本材料。",
  "系统会先生成英文大纲，用户确认后才会继续写正文。",
  "大纲可以反复修改，但会设置合理上限，避免无限循环。",
  "最终交付包含文章 Word、核验报告 PDF，以及可选的降AI后版本。",
  "额度通过激活码充值，不走在线付款。",
  "每个激活码只能用一次，但同一账号可以反复输入不同激活码。",
  "生成文章固定扣 500 积分，自动降AI固定扣 500 积分。",
  "如果额度不够，直接扫码联系销售团队补充新的激活码。"
];

const pageShellStyle = {
  background:
    "radial-gradient(circle at top right, rgba(214, 177, 101, 0.18), transparent 36%), linear-gradient(180deg, #f8f4ea 0%, #f2ebdd 48%, #fbf8f1 100%)",
  color: "#1c1a16"
} as const;

const sectionStyle = {
  maxWidth: "1200px",
  margin: "0 auto",
  padding: "0 1.5rem"
} as const;

const cardStyle = {
  borderRadius: "1.5rem",
  border: "1px solid rgba(117, 96, 57, 0.14)",
  background: "rgba(255, 255, 255, 0.88)",
  boxShadow: "0 20px 40px rgba(54, 45, 28, 0.08)"
} as const;

export default function HomePage() {
  return (
    <main style={pageShellStyle}>
      <section style={{ ...sectionStyle, paddingTop: "2rem", paddingBottom: "4rem" }}>
        <header
          style={{
            ...cardStyle,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            gap: "1rem",
            alignItems: "center",
            padding: "1rem 1.25rem",
            marginBottom: "2rem"
          }}
        >
          <BrandLogo />
          <nav
            aria-label="homepage-navigation"
            style={{ display: "flex", flexWrap: "wrap", gap: "1rem", fontSize: "0.95rem" }}
          >
            <a href="#features">功能介绍</a>
            <a href="#cases">成功案例</a>
            <a href="#faq">常见问题</a>
            <Link href="/login">登录</Link>
            <Link href="/recharge">激活额度</Link>
          </nav>
        </header>

        <div
          style={{
            display: "grid",
            gap: "1.5rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            alignItems: "stretch"
          }}
        >
          <section
            style={{
              ...cardStyle,
              padding: "2rem"
            }}
          >
            <BrandLogo variant="large" />
            <div
              style={{
                marginTop: "1rem",
                display: "inline-flex",
                padding: "0.45rem 0.8rem",
                borderRadius: "999px",
                background: "#241f17",
                color: "#f7d78d",
                fontSize: "0.88rem"
              }}
            >
              面向接单工作室与学生用户的专业写作交付平台
            </div>
            <h1
              style={{
                marginTop: "1rem",
                marginBottom: "1rem",
                fontSize: "clamp(2rem, 4vw, 3.6rem)",
                lineHeight: 1.15
              }}
            >
              批量处理，稳定交付。
              <br />
              把写作流程做成你能掌控的成品。
            </h1>
            <p style={{ margin: 0, fontSize: "1.05rem", lineHeight: 1.8, color: "#4c4336" }}>
              上传任务材料，系统自动分析要求，先生成英文大纲，确认后再写正文，最后输出
              Word 与引用核验报告。需要继续处理时，还能再走自动降AI。
            </p>
            <div
              style={{
                marginTop: "1.25rem",
                display: "grid",
                gap: "0.8rem",
                padding: "1rem",
                borderRadius: "1rem",
                background: "#fffaf0",
                border: "1px solid rgba(191, 156, 90, 0.28)"
              }}
            >
              <strong>积分规则</strong>
              <span>生成文章固定扣 500 积分</span>
              <span>自动降AI固定扣 500 积分</span>
              <span>登录后用激活码充值，不走在线付款</span>
            </div>
            <div
              style={{
                marginTop: "1.5rem",
                display: "flex",
                flexWrap: "wrap",
                gap: "0.9rem"
              }}
            >
              <Link
                href="/login"
                style={{
                  padding: "0.95rem 1.4rem",
                  borderRadius: "999px",
                  background: "#201b13",
                  color: "#fff7e5",
                  textDecoration: "none",
                  fontWeight: 700
                }}
              >
                立即登录工作台
              </Link>
              <a
                href="#contact-sales"
                style={{
                  padding: "0.95rem 1.4rem",
                  borderRadius: "999px",
                  border: "1px solid rgba(117, 96, 57, 0.35)",
                  textDecoration: "none",
                  fontWeight: 700
                }}
              >
                联系销售购买额度
              </a>
            </div>
          </section>

          <section
            style={{
              ...cardStyle,
              padding: "2rem",
              display: "grid",
              gap: "1rem"
            }}
          >
            <div style={{ fontWeight: 700, color: "#6b5732" }}>文章生产工作流程</div>
            <div
              style={{
                display: "grid",
                gap: "0.85rem"
              }}
            >
              {[
                "任务分析完成：系统已提取核心要求、目标字数和引用格式。",
                "英文大纲待确认：先看标题、章节和重点，再决定是否继续。",
                "交付物生成：Word 正文、核验报告、降AI后版本都能在同页查看。"
              ].map((item) => (
                <div
                  key={item}
                  style={{
                    padding: "1rem",
                    borderRadius: "1rem",
                    background: "#fbf8f1",
                    border: "1px solid rgba(117, 96, 57, 0.12)",
                    lineHeight: 1.7
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
            <div
              style={{
                padding: "1rem",
                borderRadius: "1rem",
                background: "linear-gradient(135deg, #221c14 0%, #3b2d1a 100%)",
                color: "#fff1cf"
              }}
            >
              <strong>为什么很多人更喜欢这套流程</strong>
              <p style={{ marginBottom: 0, lineHeight: 1.7 }}>
                不是一上来就盲写，而是先把结构定准，再交付成稿。这样更像真正能卖的服务，不像一次性小工具。
              </p>
            </div>
          </section>
        </div>
      </section>

      <section style={{ ...sectionStyle, paddingBottom: "2rem" }}>
        <div
          style={{
            ...cardStyle,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "0.8rem",
            padding: "1rem"
          }}
        >
          {trustHighlights.map((item) => (
            <div
              key={item}
              style={{
                padding: "0.8rem 1rem",
                borderRadius: "999px",
                background: "#fffdf7",
                border: "1px solid rgba(117, 96, 57, 0.12)",
                textAlign: "center",
                fontSize: "0.92rem"
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </section>

      <section style={{ ...sectionStyle, paddingTop: "2rem", paddingBottom: "4rem" }}>
        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <h2 style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>适合谁用</h2>
          <p style={{ margin: 0, color: "#554b3d", lineHeight: 1.7 }}>
            拼代代PDD 重点服务两类高频用户：一类是接单的人，一类是需要高质量交付的学生用户。
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gap: "1rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))"
          }}
        >
          {audienceCards.map((item) => (
            <article key={item.title} style={{ ...cardStyle, padding: "1.5rem" }}>
              <h3 style={{ marginTop: 0 }}>{item.title}</h3>
              <p style={{ lineHeight: 1.7, color: "#5a503f" }}>{item.pain}</p>
              <p style={{ marginBottom: 0, lineHeight: 1.7, fontWeight: 700, color: "#2a2319" }}>
                {item.value}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        style={{
          paddingTop: "4rem",
          paddingBottom: "4rem",
          background: "rgba(37, 31, 23, 0.92)",
          color: "#fbf4e7"
        }}
      >
        <div style={sectionStyle}>
          <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
            <h2 style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>透明可控的核心流程</h2>
            <p style={{ margin: 0, color: "#e0d2b3", lineHeight: 1.7 }}>
              用户在同一个页面里完成输入、等待、确认和下载，流程不是黑盒。
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gap: "1rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
            }}
          >
            {processSteps.map((item, index) => (
              <div
                key={item}
                style={{
                  padding: "1.1rem",
                  borderRadius: "1rem",
                  background: "rgba(255, 255, 255, 0.06)",
                  border: "1px solid rgba(255, 230, 179, 0.12)"
                }}
              >
                <strong style={{ display: "block", marginBottom: "0.45rem", color: "#f5d285" }}>
                  {String(index + 1).padStart(2, "0")}
                </strong>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" style={{ ...sectionStyle, paddingTop: "4rem", paddingBottom: "4rem" }}>
        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <h2 style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>核心功能</h2>
          <p style={{ margin: 0, color: "#554b3d", lineHeight: 1.7 }}>
            不只是出文章，而是一整套更容易卖、更容易交付的工作流程。
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gap: "1rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))"
          }}
        >
          {featureCards.map((item) => (
            <div
              key={item}
              style={{
                ...cardStyle,
                padding: "1.35rem",
                fontWeight: 700
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </section>

      <section
        id="cases"
        style={{
          paddingTop: "4rem",
          paddingBottom: "4rem",
          background: "rgba(246, 239, 225, 0.95)"
        }}
      >
        <div style={sectionStyle}>
          <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
            <h2 style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>成功案例展示</h2>
            <p style={{ margin: 0, color: "#554b3d", lineHeight: 1.7 }}>
              这里展示的是典型使用场景，不冒充真实学校、真实机构或真实奖项。
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gap: "1rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))"
            }}
          >
            {caseCards.map((item) => (
              <article key={item.title} style={{ ...cardStyle, padding: "1.4rem" }}>
                <h3 style={{ marginTop: 0, marginBottom: "0.8rem" }}>{item.title}</h3>
                <p style={{ margin: 0, lineHeight: 1.7, color: "#554b3d" }}>{item.summary}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section style={{ ...sectionStyle, paddingTop: "4rem", paddingBottom: "4rem" }}>
        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <h2 style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>用户反馈</h2>
          <p style={{ margin: 0, color: "#554b3d", lineHeight: 1.7 }}>
            用匿名场景描述来展示用户真实会关心的点，不靠虚假背书堆信任感。
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gap: "1rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))"
          }}
        >
          {feedbackCards.map((item) => (
            <div key={item} style={{ ...cardStyle, padding: "1.25rem", lineHeight: 1.7 }}>
              {item}
            </div>
          ))}
        </div>
      </section>

      <section
        style={{
          paddingTop: "4rem",
          paddingBottom: "4rem",
          background: "rgba(34, 29, 21, 0.94)",
          color: "#f9f1df"
        }}
      >
        <div style={sectionStyle}>
          <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
            <h2 style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>平台服务标准</h2>
            <p style={{ margin: 0, color: "#dfcfaf", lineHeight: 1.7 }}>
              在没有真实合作机构和奖项之前，最能建立信任的，是把规则和交付说清楚。
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gap: "1rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))"
            }}
          >
            {serviceStandards.map((item) => (
              <div
                key={item}
                style={{
                  padding: "1rem",
                  borderRadius: "1rem",
                  background: "rgba(255, 255, 255, 0.06)",
                  border: "1px solid rgba(255, 236, 199, 0.1)",
                  textAlign: "center"
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ ...sectionStyle, paddingTop: "4rem", paddingBottom: "4rem" }}>
        <div
          style={{
            ...cardStyle,
            padding: "2rem"
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: "2rem" }}>额度激活码说明</h2>
          <p style={{ lineHeight: 1.8, color: "#554b3d" }}>
            用户登录后，不是在线付款，而是输入一次性激活码给账户充值。激活码只能使用一次，但同一账号可以多次兑换不同激活码。
          </p>
          <div
            style={{
              display: "grid",
              gap: "1rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              marginTop: "1rem"
            }}
          >
            {["1000 积分", "5000 积分", "10000 积分", "20000 积分"].map((item) => (
              <div
                key={item}
                style={{
                  padding: "1rem",
                  borderRadius: "1rem",
                  background: "#fffaf1",
                  border: "1px solid rgba(117, 96, 57, 0.12)",
                  textAlign: "center",
                  fontWeight: 700
                }}
              >
                {item}
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: "1rem",
              display: "grid",
              gap: "0.5rem",
              color: "#4e4538"
            }}
          >
            <span>生成文章固定扣 500 积分</span>
            <span>自动降AI固定扣 500 积分</span>
          </div>
          <div style={{ marginTop: "1.25rem" }}>
            <Link
              href="/recharge"
              style={{
                display: "inline-block",
                padding: "0.95rem 1.4rem",
                borderRadius: "999px",
                background: "#201b13",
                color: "#fff7e5",
                textDecoration: "none",
                fontWeight: 700
              }}
            >
              去额度中心输入激活码
            </Link>
          </div>
        </div>
      </section>

      <section id="contact-sales" style={{ ...sectionStyle, paddingBottom: "4rem" }}>
        <ContactSalesCard />
      </section>

      <section id="faq" style={{ ...sectionStyle, paddingBottom: "4rem" }}>
        <div style={{ ...cardStyle, padding: "2rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "2rem", marginBottom: "1rem" }}>常见问题</h2>
          <div
            style={{
              display: "grid",
              gap: "0.9rem"
            }}
          >
            {faqItems.map((item, index) => (
              <div
                key={item}
                style={{
                  padding: "1rem",
                  borderRadius: "1rem",
                  background: "#fffaf2",
                  border: "1px solid rgba(117, 96, 57, 0.1)",
                  lineHeight: 1.7
                }}
              >
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

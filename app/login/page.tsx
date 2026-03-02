import Link from "next/link";
import { BrandLogo } from "../../src/components/brand/brand-logo";
import { ContactSalesCard } from "../../src/components/brand/contact-sales-card";

type LoginPageProps = {
  searchParams?: Promise<{
    redirect?: string;
  }>;
};

const inputStyle = {
  width: "100%",
  borderRadius: "0.9rem",
  border: "1px solid rgba(117, 96, 57, 0.18)",
  background: "#fffdf8",
  padding: "0.9rem 1rem",
  fontSize: "0.95rem"
} as const;

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const redirectTarget = resolvedSearchParams.redirect ?? "/workspace";

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "2rem 1.5rem",
        background:
          "radial-gradient(circle at top left, rgba(214, 177, 101, 0.18), transparent 32%), linear-gradient(180deg, #f7f2e6 0%, #f3ecdf 52%, #fbf8f2 100%)"
      }}
    >
      <div
        style={{
          maxWidth: "1180px",
          margin: "0 auto",
          display: "grid",
          gap: "1.5rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          alignItems: "center"
        }}
      >
        <section
          style={{
            borderRadius: "1.75rem",
            border: "1px solid rgba(117, 96, 57, 0.14)",
            background: "rgba(255, 255, 255, 0.88)",
            padding: "2rem",
            boxShadow: "0 20px 40px rgba(54, 45, 28, 0.08)"
          }}
        >
          <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
            <BrandLogo variant="large" />
          </Link>
          <p
            style={{
              marginTop: "1rem",
              marginBottom: "0.5rem",
              fontSize: "0.95rem",
              color: "#6a5941"
            }}
          >
            登录后可继续创建和交付任务
          </p>
          <h1 style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "2.2rem" }}>欢迎回来</h1>
          <p style={{ marginTop: 0, lineHeight: 1.8, color: "#524838" }}>
            这里先保留登录页外壳。等后面接上真实登录后，登录成功会回到：
            <strong> {redirectTarget}</strong>
          </p>

          <form style={{ display: "grid", gap: "1rem", marginTop: "1.5rem" }}>
            <label style={{ display: "grid", gap: "0.45rem" }}>
              <span>邮箱地址</span>
              <input type="email" placeholder="you@example.com" style={inputStyle} />
            </label>
            <label style={{ display: "grid", gap: "0.45rem" }}>
              <span>密码</span>
              <input type="password" placeholder="请输入密码" style={inputStyle} />
            </label>
            <button
              type="button"
              style={{
                marginTop: "0.4rem",
                border: 0,
                borderRadius: "999px",
                padding: "0.95rem 1.2rem",
                background: "#201b13",
                color: "#fff7e5",
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              登录工作台
            </button>
          </form>

          <div
            style={{
              marginTop: "1rem",
              display: "flex",
              flexWrap: "wrap",
              gap: "0.8rem",
              alignItems: "center"
            }}
          >
            <Link href="/register">注册新账号</Link>
            <a href="#sales-tip">联系客服购买额度</a>
          </div>
        </section>

        <div id="sales-tip">
          <ContactSalesCard
            title="还没有额度？先联系销售团队"
            description="注册后账号可长期使用。真正开始用的时候，输入一次性激活码即可到账积分，不需要走在线付款。"
          />
        </div>
      </div>
    </main>
  );
}

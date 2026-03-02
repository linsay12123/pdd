import Link from "next/link";
import { BrandLogo } from "../../src/components/brand/brand-logo";

const inputStyle = {
  width: "100%",
  borderRadius: "0.9rem",
  border: "1px solid rgba(117, 96, 57, 0.18)",
  background: "#fffdf8",
  padding: "0.9rem 1rem",
  fontSize: "0.95rem"
} as const;

export default function RegisterPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "2rem 1.5rem",
        background:
          "radial-gradient(circle at top right, rgba(214, 177, 101, 0.18), transparent 32%), linear-gradient(180deg, #f8f4ea 0%, #f2ebdd 48%, #fbf8f1 100%)"
      }}
    >
      <section
        style={{
          width: "min(100%, 620px)",
          margin: "0 auto",
          borderRadius: "1.75rem",
          border: "1px solid rgba(117, 96, 57, 0.14)",
          background: "rgba(255, 255, 255, 0.9)",
          padding: "2rem",
          boxShadow: "0 20px 40px rgba(54, 45, 28, 0.08)"
        }}
      >
        <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
          <BrandLogo variant="large" />
        </Link>
        <p style={{ marginTop: "1rem", marginBottom: "0.5rem", color: "#6a5941" }}>
          注册后可长期使用账号
        </p>
        <h1 style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "2.2rem" }}>注册拼代代PDD</h1>
        <p style={{ marginTop: 0, lineHeight: 1.8, color: "#524838" }}>
          注册完成后，你可以随时登录。真正充值时，不是在线付款，而是输入一次性
          额度激活码给账户加积分。
        </p>

        <form style={{ display: "grid", gap: "1rem", marginTop: "1.5rem" }}>
          <label style={{ display: "grid", gap: "0.45rem" }}>
            <span>用户名</span>
            <input type="text" placeholder="你的称呼" style={inputStyle} />
          </label>
          <label style={{ display: "grid", gap: "0.45rem" }}>
            <span>邮箱地址</span>
            <input type="email" placeholder="you@example.com" style={inputStyle} />
          </label>
          <label style={{ display: "grid", gap: "0.45rem" }}>
            <span>密码</span>
            <input type="password" placeholder="请输入密码" style={inputStyle} />
          </label>
          <label style={{ display: "grid", gap: "0.45rem" }}>
            <span>确认密码</span>
            <input type="password" placeholder="再次输入密码" style={inputStyle} />
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
            注册并进入工作台
          </button>
        </form>

        <div
          style={{
            marginTop: "1rem",
            padding: "1rem",
            borderRadius: "1rem",
            background: "#fff9ee",
            border: "1px solid rgba(117, 96, 57, 0.12)",
            lineHeight: 1.7
          }}
        >
          提醒：注册成功后，使用额度激活码即可给账户充值。每个激活码只能用一次，但同一账号可以多次兑换不同激活码。
        </div>

        <div style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "0.8rem" }}>
          <Link href="/login">已有账号，去登录</Link>
          <a href="/#contact-sales">联系客服购买额度</a>
        </div>
      </section>
    </main>
  );
}

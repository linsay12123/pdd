import Link from "next/link";
import { BrandLogo } from "@/src/components/brand/brand-logo";

export default function RegisterPage() {
  return (
    <main style={{ padding: "52px 0" }}>
      <div className="pdd-container" style={{ maxWidth: "720px" }}>
        <section className="pdd-card" style={{ padding: "30px" }}>
          <Link href="/" style={{ display: "inline-flex", marginBottom: "8px" }}>
            <BrandLogo variant="large" />
          </Link>
          <p className="pdd-sub">注册后可长期使用账号</p>
          <h1 className="pdd-heading" style={{ fontSize: "2.2rem", marginTop: "8px" }}>
            注册拼代代PDD
          </h1>
          <p className="pdd-sub" style={{ marginBottom: "18px" }}>
            注册完成后，通过额度激活码充值。每个激活码只能用一次，但同一账号可多次兑换不同激活码。
          </p>

          <form className="pdd-list" style={{ gap: "12px" }}>
            <label className="pdd-list" style={{ gap: "6px" }}>
              <span>用户名</span>
              <input className="pdd-input" type="text" placeholder="你的称呼" />
            </label>
            <label className="pdd-list" style={{ gap: "6px" }}>
              <span>邮箱地址</span>
              <input className="pdd-input" type="email" placeholder="you@example.com" />
            </label>
            <label className="pdd-list" style={{ gap: "6px" }}>
              <span>密码</span>
              <input className="pdd-input" type="password" placeholder="请输入密码" />
            </label>
            <label className="pdd-list" style={{ gap: "6px" }}>
              <span>确认密码</span>
              <input className="pdd-input" type="password" placeholder="再次输入密码" />
            </label>
            <button className="pdd-btn pdd-btn-primary" type="button">
              注册并进入工作台
            </button>
          </form>

          <div className="pdd-card-plain" style={{ padding: "12px", marginTop: "14px" }}>
            <strong>提示：</strong>额度激活码分 1000 / 5000 / 10000 / 20000 四档。
          </div>

          <div style={{ marginTop: "14px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <Link href="/login">已有账号，去登录</Link>
            <a href="/#contact-sales">联系客服购买额度</a>
          </div>
        </section>
      </div>
    </main>
  );
}

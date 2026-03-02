import Link from "next/link";
import { BrandLogo } from "@/src/components/brand/brand-logo";
import { ContactSalesCard } from "@/src/components/brand/contact-sales-card";

type LoginPageProps = {
  searchParams?: Promise<{
    redirect?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const redirectTarget = resolvedSearchParams.redirect ?? "/workspace";

  return (
    <main style={{ padding: "52px 0" }}>
      <div className="pdd-container pdd-grid-2">
        <section className="pdd-card" style={{ padding: "30px" }}>
          <Link href="/" className="pdd-logo-wrap" style={{ marginBottom: "10px" }}>
            <img src="/logo.jpg" alt="拼代代PDD logo" />
            <strong style={{ fontSize: "1.2rem" }}>拼代代PDD</strong>
          </Link>
          <p className="pdd-sub">登录后可继续创建和交付任务</p>
          <h1 className="pdd-heading" style={{ fontSize: "2.2rem", marginTop: "8px" }}>
            欢迎回来
          </h1>
          <p className="pdd-sub" style={{ marginBottom: "18px" }}>
            当前登录后将跳转到：<strong>{redirectTarget}</strong>
          </p>

          <form className="pdd-list" style={{ gap: "12px" }}>
            <label className="pdd-list" style={{ gap: "6px" }}>
              <span>邮箱地址</span>
              <input className="pdd-input" type="email" placeholder="you@example.com" />
            </label>
            <label className="pdd-list" style={{ gap: "6px" }}>
              <span>密码</span>
              <input className="pdd-input" type="password" placeholder="请输入密码" />
            </label>
            <button className="pdd-btn pdd-btn-primary" type="button">
              登录工作台
            </button>
          </form>

          <div style={{ marginTop: "14px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <Link href="/register">注册新账号</Link>
            <a href="#sales-tip">联系客服购买额度</a>
          </div>
        </section>

        <aside id="sales-tip">
          <ContactSalesCard
            title="没有额度？先联系销售"
            description="注册后账号长期有效。需要使用时，输入一次性激活码即可到账积分。"
          />
        </aside>
      </div>
    </main>
  );
}

import type { ReactNode } from "react";
import Link from "next/link";

type AppLayoutProps = {
  children: ReactNode;
};

const navigationItems = [
  { href: "/workspace", label: "开始写作" },
  { href: "/tasks", label: "我的任务" },
  { href: "/billing", label: "充值中心" },
  { href: "/account", label: "账户中心" }
];

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "260px 1fr",
        background:
          "radial-gradient(circle at top left, #fff7de 0%, #f4efe6 45%, #efe8db 100%)"
      }}
    >
      <aside
        style={{
          padding: "24px",
          borderRight: "1px solid #d7cfbe",
          background: "rgba(255, 250, 240, 0.88)"
        }}
      >
        <p style={{ margin: 0, fontSize: "12px", letterSpacing: "0.08em" }}>
          Auto Writing
        </p>
        <h2 style={{ marginTop: "8px", marginBottom: "24px" }}>工作台</h2>
        <nav style={{ display: "grid", gap: "12px" }}>
          {navigationItems.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div style={{ display: "grid", gridTemplateRows: "auto 1fr" }}>
        <header
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #d7cfbe",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "rgba(255, 255, 255, 0.72)"
          }}
        >
          <div>
            <strong>当前余额</strong>
            <div>充值额度 0 | 订阅额度 0</div>
          </div>
          <div style={{ fontSize: "14px" }}>登录接通后这里显示用户信息</div>
        </header>
        <main style={{ padding: "24px" }}>{children}</main>
      </div>
    </div>
  );
}

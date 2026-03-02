import type { ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "@/src/components/brand/brand-logo";

type AppLayoutProps = {
  children: ReactNode;
};

const navigationItems = [
  { href: "/workspace", label: "开始写作" },
  { href: "/tasks", label: "我的任务" },
  { href: "/billing", label: "额度中心" },
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
        <BrandLogo />
        <p style={{ marginTop: "14px", marginBottom: "24px", lineHeight: 1.7, color: "#5d523f" }}>
          登录后，任务、积分、下载入口都集中在这个主工作区里。
        </p>
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
            <strong>当前积分</strong>
            <div>账户积分 0 | 生成文章固定扣 500 | 自动降AI固定扣 500</div>
          </div>
          <div style={{ fontSize: "14px" }}>登录接通后这里显示用户信息</div>
        </header>
        <main style={{ padding: "24px" }}>{children}</main>
      </div>
    </div>
  );
}

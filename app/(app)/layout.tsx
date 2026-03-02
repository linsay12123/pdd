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
    <div className="pdd-app-shell">
      <aside className="pdd-app-aside">
        <BrandLogo />
        <p className="pdd-sub" style={{ fontSize: "14px" }}>
          在同一个工作区里完成上传、确认、生成、下载，不用来回跳页面。
        </p>
        <nav>
          {navigationItems.map((item) => (
            <Link key={item.href} className="pdd-app-link" href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="pdd-app-main">
        <header className="pdd-app-header">
          <div className="pdd-list" style={{ gap: "2px" }}>
            <strong>当前积分</strong>
            <span style={{ color: "#475569", fontSize: "14px" }}>
              账户积分 12000 | 生成文章固定扣 500 | 自动降AI固定扣 500
            </span>
          </div>
          <div style={{ fontSize: "14px", color: "#475569" }}>演示账号：demo-user</div>
        </header>
        <main className="pdd-app-content">{children}</main>
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/src/lib/auth/admin-guard";

type AdminLayoutProps = {
  children: ReactNode;
};

const adminNavigationItems = [
  { href: "/admin", label: "总览" },
  { href: "/admin/users", label: "用户" },
  { href: "/admin/orders", label: "订单" },
  { href: "/admin/tasks", label: "任务" },
  { href: "/admin/files", label: "文件" },
  { href: "/admin/pricing", label: "价格" },
  { href: "/admin/finance", label: "财务" }
];

export default async function AdminLayout({ children }: AdminLayoutProps) {
  try {
    await requireAdminSession();
  } catch {
    redirect("/workspace");
  }

  return (
    <div style={{ display: "grid", gap: "18px" }}>
      <section
        style={{
          padding: "18px",
          borderRadius: "18px",
          border: "1px solid #d7cfbe",
          background:
            "linear-gradient(135deg, rgba(72, 49, 25, 0.95), rgba(142, 110, 61, 0.92))",
          color: "#fff7e8"
        }}
      >
        <p style={{ margin: 0, fontSize: "12px", letterSpacing: "0.08em" }}>
          Admin Console
        </p>
        <h1 style={{ marginTop: "8px", marginBottom: "8px" }}>运营中控后台</h1>
        <p style={{ margin: 0 }}>
          这里给你集中处理用户、订单、任务、价格和财务。所有操作都应该落审计日志。
        </p>
      </section>

      <nav
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px"
        }}
      >
        {adminNavigationItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              padding: "8px 12px",
              borderRadius: "999px",
              border: "1px solid #c9b488",
              background: "#fffaf1",
              textDecoration: "none",
              color: "#4d3519"
            }}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}

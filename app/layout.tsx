import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

type RootLayoutProps = {
  children: ReactNode;
};

export const metadata: Metadata = {
  title: "拼代代PDD",
  description: "拼代代PDD 文章自动写作与额度激活平台"
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

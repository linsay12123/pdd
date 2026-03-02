import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import Navbar from "@/src/components/layout/Navbar";
import Footer from "@/src/components/layout/Footer";

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
      <body>
        <div className="min-h-screen flex flex-col bg-brand-950 text-cream-50 font-sans selection:bg-gold-500/30 selection:text-gold-300">
          <Navbar />
          <main className="flex-grow">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/src/components/ui/Button";
import { LogIn, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/src/lib/utils";
import { HOME_SECTION_LINKS } from "@/src/lib/brand/support-links";
import { buildWorkspaceEntryPath } from "@/src/lib/auth/auth-form";

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const navLinks = [
    { name: "首页", path: "/" },
    { name: "功能介绍", path: HOME_SECTION_LINKS.features },
    { name: "成功案例", path: HOME_SECTION_LINKS.cases },
    { name: "常见问题", path: HOME_SECTION_LINKS.faq }
  ];
  const workspaceEntryPath = buildWorkspaceEntryPath("/workspace");

  return (
    <header
      className={cn(
        "fixed top-0 w-full z-50 transition-all duration-300 border-b",
        isScrolled
          ? "bg-brand-950/80 backdrop-blur-lg border-white/10 py-3 shadow-lg"
          : "bg-transparent border-transparent py-5"
      )}
    >
      <div className="container mx-auto px-6 md:px-12 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform shadow-[0_0_15px_rgba(220,38,38,0.2)]">
              <img src="/logo.png" alt="拼代代 Logo" className="w-full h-full object-cover" />
            </div>
            <span className="text-2xl font-serif font-bold tracking-tight text-cream-50">拼代代</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.path}
                className="text-sm font-medium text-cream-100/70 hover:text-gold-400 transition-colors"
              >
                {link.name}
              </a>
            ))}
          </nav>
        </div>

        <div className="hidden md:flex items-center gap-4">
          <Link href="/login">
            <Button variant="ghost" size="sm" className="gap-2">
              <LogIn className="w-4 h-4" />
              登录
            </Button>
          </Link>
          <Link href={workspaceEntryPath}>
            <Button size="sm">进入工作台</Button>
          </Link>
          <a href={HOME_SECTION_LINKS.contactSupport}>
            <Button variant="outline" size="sm" className="border-gold-500/50">
              联系客服支持团队
            </Button>
          </a>
        </div>

        <button className="md:hidden text-cream-50" onClick={() => setMobileMenuOpen((v) => !v)}>
          {mobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-brand-900 border-b border-white/10 py-4 px-6 flex flex-col gap-4 shadow-2xl">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.path}
              className="text-base font-medium text-cream-100/80 hover:text-gold-400 py-2 border-b border-white/5"
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.name}
            </a>
          ))}
          <div className="flex flex-col gap-3 mt-4">
            <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="secondary" fullWidth>
                登录
              </Button>
            </Link>
            <Link href={workspaceEntryPath} onClick={() => setMobileMenuOpen(false)}>
              <Button fullWidth>进入工作台</Button>
            </Link>
            <a href={HOME_SECTION_LINKS.contactSupport} onClick={() => setMobileMenuOpen(false)}>
              <Button variant="outline" fullWidth>
                联系客服支持团队
              </Button>
            </a>
          </div>
        </div>
      )}
    </header>
  );
}

"use client";

import { Button } from "@/src/components/ui/Button";
import { Mail, Lock, ArrowRight } from "lucide-react";
import Link from "next/link";
import React from "react";

export default function Login() {
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== "undefined") {
      window.location.href = "/workspace";
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16 flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-2 mb-6 group">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden shadow-[0_0_20px_rgba(220,38,38,0.2)] group-hover:scale-105 transition-transform">
              <img src="/logo.png" alt="拼代代 Logo" className="w-full h-full object-cover" />
            </div>
          </Link>
          <h1 className="text-3xl font-serif font-bold text-cream-50 mb-2">欢迎回来</h1>
          <p className="text-brand-700">登录拼代代，继续您的专业创作</p>
        </div>

        <div className="glass-panel p-8 rounded-2xl border-gold-glow">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-cream-100 mb-2">邮箱地址</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-brand-700" />
                </div>
                <input
                  type="email"
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-white/10 rounded-xl bg-brand-950/50 text-cream-50 placeholder-brand-700 focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-transparent transition-all"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-cream-100">密码</label>
                <a href="#" className="text-xs text-gold-400 hover:text-gold-300">
                  忘记密码？
                </a>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-brand-700" />
                </div>
                <input
                  type="password"
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-white/10 rounded-xl bg-brand-950/50 text-cream-50 placeholder-brand-700 focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-transparent transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <Button type="submit" fullWidth size="lg" className="mt-8">
              登录工作台
            </Button>
          </form>

          <div className="mt-8 text-center text-sm text-brand-700">
            还没有账号？{" "}
            <Link href="/register" className="text-gold-400 hover:text-gold-300 font-medium inline-flex items-center gap-1">
              立即注册 <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        <div className="mt-8 text-center">
          <a href="/#contact-sales" className="text-xs text-brand-700 hover:text-cream-50 transition-colors">
            需要人工客服协助？联系销售团队
          </a>
        </div>
      </div>
    </div>
  );
}

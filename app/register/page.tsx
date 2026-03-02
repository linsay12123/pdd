"use client";

import { Button } from "@/src/components/ui/Button";
import { Mail, Lock, ArrowRight, User } from "lucide-react";
import Link from "next/link";
import React from "react";

export default function Register() {
  const handleRegister = (e: React.FormEvent) => {
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
          <h1 className="text-3xl font-serif font-bold text-cream-50 mb-2">注册拼代代</h1>
          <p className="text-brand-700">开启高效、稳定的写作交付体验</p>
        </div>

        <div className="glass-panel p-8 rounded-2xl border-gold-glow">
          <form onSubmit={handleRegister} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-cream-100 mb-2">用户名</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-brand-700" />
                </div>
                <input
                  type="text"
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-white/10 rounded-xl bg-brand-950/50 text-cream-50 placeholder-brand-700 focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-transparent transition-all"
                  placeholder="您的称呼"
                />
              </div>
            </div>

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
              <label className="block text-sm font-medium text-cream-100 mb-2">密码</label>
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

            <div>
              <label className="block text-sm font-medium text-cream-100 mb-2">确认密码</label>
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
              注册并进入工作台
            </Button>
          </form>

          <div className="mt-6 text-center text-xs text-brand-700 bg-brand-900/50 p-3 rounded-lg border border-white/5">
            注册成功后，您可以通过输入“额度激活码”为账户充值积分。
          </div>

          <div className="mt-8 text-center text-sm text-brand-700">
            已有账号？{" "}
            <Link href="/login" className="text-gold-400 hover:text-gold-300 font-medium inline-flex items-center gap-1">
              立即登录 <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

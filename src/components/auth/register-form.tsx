"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Mail, Lock, ArrowRight, User } from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import { createSupabaseBrowserClient } from "@/src/lib/supabase/client";
import {
  getAuthErrorMessage,
  validateRegisterInput
} from "@/src/lib/auth/auth-form";

export function RegisterForm() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [statusText, setStatusText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateRegisterInput({
      displayName,
      email,
      password,
      confirmPassword
    });

    if (validationError) {
      setStatusText(validationError);
      return;
    }

    setSubmitting(true);
    setStatusText("注册中...");

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: displayName.trim()
          }
        }
      });

      if (error) {
        setStatusText(getAuthErrorMessage(error, "register"));
        return;
      }

      if (!data.session) {
        setStatusText("注册成功，请回到登录页继续登录");
        return;
      }

      setStatusText("注册成功，正在进入工作台...");
      if (typeof window !== "undefined") {
        window.location.assign("/workspace");
      }
    } catch {
      setStatusText("注册失败，请稍后再试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
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
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
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
              value={email}
              onChange={(event) => setEmail(event.target.value)}
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
              value={password}
              onChange={(event) => setPassword(event.target.value)}
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
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="block w-full pl-10 pr-3 py-3 border border-white/10 rounded-xl bg-brand-950/50 text-cream-50 placeholder-brand-700 focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-transparent transition-all"
              placeholder="••••••••"
            />
          </div>
        </div>

        <Button type="submit" fullWidth size="lg" className="mt-8" disabled={submitting}>
          {submitting ? "注册中..." : "注册并进入工作台"}
        </Button>
      </form>

      <div className="mt-4 min-h-6 text-sm text-brand-700" aria-live="polite">
        {statusText}
      </div>

      <div className="mt-6 text-center text-xs text-brand-700 bg-brand-900/50 p-3 rounded-lg border border-white/5">
        注册成功后，您可以通过输入“额度激活码”为账户充值积分。
      </div>

      <div className="mt-8 text-center text-sm text-brand-700">
        已有账号？{" "}
        <Link href="/login" className="text-gold-400 hover:text-gold-300 font-medium inline-flex items-center gap-1">
          立即登录 <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </>
  );
}

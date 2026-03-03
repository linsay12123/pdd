"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import { createSupabaseBrowserClient } from "@/src/lib/supabase/client";
import {
  buildWorkspaceEntryPath,
  getAuthErrorMessage,
  normalizeRedirectTarget
} from "@/src/lib/auth/auth-form";
import { getSessionTokens, syncSessionToServer } from "@/src/lib/auth/client-session-sync";

type LoginFormProps = {
  redirectTo?: string;
  initialStatusText?: string;
};

export function LoginForm({ redirectTo, initialStatusText = "" }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [statusText, setStatusText] = useState(initialStatusText);
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStatusText("登录中...");

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (error) {
        setStatusText(getAuthErrorMessage(error, "login"));
        return;
      }

      setStatusText("登录成功，正在进入工作台...");
      await syncSessionToServer(getSessionTokens(data.session));
      if (typeof window !== "undefined") {
        window.location.assign(buildWorkspaceEntryPath(normalizeRedirectTarget(redirectTo)));
      }
    } catch {
      setStatusText("登录失败，请稍后再试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
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
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="block w-full pl-10 pr-3 py-3 border border-white/10 rounded-xl bg-brand-950/50 text-cream-50 placeholder-brand-700 focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-transparent transition-all"
              placeholder="you@example.com"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-cream-100">密码</label>
            <Link href="/forgot-password" className="text-xs text-gold-400 hover:text-gold-300">
              忘记密码？
            </Link>
          </div>
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

        <Button type="submit" fullWidth size="lg" className="mt-8" disabled={submitting}>
          {submitting ? "登录中..." : "登录工作台"}
        </Button>
      </form>

      <div className="mt-4 min-h-6 text-sm text-brand-700" aria-live="polite">
        {statusText}
      </div>

      <div className="mt-8 text-center text-sm text-brand-700">
        还没有账号？{" "}
        <Link href="/register" className="text-gold-400 hover:text-gold-300 font-medium inline-flex items-center gap-1">
          立即注册 <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </>
  );
}

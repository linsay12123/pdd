"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import { createSupabaseBrowserClient } from "@/src/lib/supabase/client";
import {
  getPasswordResetLinkErrorMessage,
  getPasswordUpdateErrorMessage,
  getPasswordUpdateSuccessMessage
} from "@/src/lib/auth/password-reset-flow";

type ResetPasswordFormProps = {
  initialStatusText?: string;
};

export function ResetPasswordForm({ initialStatusText = "" }: ResetPasswordFormProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [statusText, setStatusText] = useState(initialStatusText);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < 8) {
      setStatusText("密码至少需要 8 位。");
      return;
    }

    if (password !== confirmPassword) {
      setStatusText("两次输入的密码不一致。");
      return;
    }

    setSubmitting(true);
    setStatusText("保存中...");

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({
        password
      });

      if (error) {
        setStatusText(getPasswordUpdateErrorMessage(error));
        return;
      }

      const message = getPasswordUpdateSuccessMessage();
      setStatusText(message);
      if (typeof window !== "undefined") {
        window.location.assign(`/login?message=${encodeURIComponent(message)}`);
      }
    } catch {
      setStatusText(getPasswordResetLinkErrorMessage());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-cream-100 mb-2">新密码</label>
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
              placeholder="至少 8 位"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-cream-100 mb-2">确认新密码</label>
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
              placeholder="再次输入新密码"
            />
          </div>
        </div>

        <Button type="submit" fullWidth size="lg" className="mt-8" disabled={submitting}>
          {submitting ? "保存中..." : "保存新密码"}
        </Button>
      </form>

      <div className="mt-4 min-h-6 text-sm text-brand-700" aria-live="polite">
        {statusText}
      </div>

      <div className="mt-8 text-center text-sm text-brand-700">
        已经想起密码了？{" "}
        <Link href="/login" className="text-gold-400 hover:text-gold-300 font-medium inline-flex items-center gap-1">
          返回登录 <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </>
  );
}

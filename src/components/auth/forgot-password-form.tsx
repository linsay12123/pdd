"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import { createSupabaseBrowserClient } from "@/src/lib/supabase/client";
import {
  buildPasswordResetEmailRedirectTo,
  getPasswordResetCompletionMessage,
  getPasswordResetRequestErrorMessage
} from "@/src/lib/auth/password-reset-flow";

type ForgotPasswordFormProps = {
  initialStatusText?: string;
};

export function ForgotPasswordForm({ initialStatusText = "" }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState("");
  const [statusText, setStatusText] = useState(initialStatusText);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStatusText("发送中...");

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: buildPasswordResetEmailRedirectTo(window.location.origin)
      });

      if (error) {
        setStatusText(getPasswordResetRequestErrorMessage(error));
        return;
      }

      setStatusText(getPasswordResetCompletionMessage());
    } catch {
      setStatusText("暂时无法发送重置密码邮件，请稍后再试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
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

        <Button type="submit" fullWidth size="lg" className="mt-8" disabled={submitting}>
          {submitting ? "发送中..." : "发送重置密码邮件"}
        </Button>
      </form>

      <div className="mt-4 min-h-6 text-sm text-brand-700" aria-live="polite">
        {statusText}
      </div>

      <div className="mt-8 text-center text-sm text-brand-700">
        想起密码了？{" "}
        <Link href="/login" className="text-gold-400 hover:text-gold-300 font-medium inline-flex items-center gap-1">
          返回登录 <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </>
  );
}

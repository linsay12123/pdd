"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Button } from "@/src/components/ui/Button";

type AuthCompletePageClientProps = {
  nextPath: string;
};

const maxAttempts = 5;
const retryDelayMs = 500;

export function AuthCompletePageClient({ nextPath }: AuthCompletePageClientProps) {
  const [statusText, setStatusText] = useState("正在同步您的账号状态，请稍候...");
  const [attempts, setAttempts] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkReady(currentAttempt: number) {
      try {
        const response = await fetch("/api/auth/session-ready", {
          cache: "no-store"
        });
        const payload = (await response.json()) as {
          ready?: boolean;
          reason?: string;
        };

        if (cancelled) {
          return;
        }

        if (payload.ready) {
          setStatusText("账号状态已经同步完成，正在进入工作台...");
          window.location.assign(nextPath);
          return;
        }

        if (payload.reason === "frozen") {
          setStatusText("当前账号已被冻结，请联系客服支持团队处理。");
          setTimedOut(true);
          return;
        }

        if (currentAttempt >= maxAttempts) {
          setStatusText("账号状态同步超时，暂时还没能进入工作台。");
          setTimedOut(true);
          return;
        }

        setAttempts(currentAttempt);
        retryTimer.current = setTimeout(() => {
          void checkReady(currentAttempt + 1);
        }, retryDelayMs);
      } catch {
        if (cancelled) {
          return;
        }

        if (currentAttempt >= maxAttempts) {
          setStatusText("暂时无法确认登录状态，请重试一次。");
          setTimedOut(true);
          return;
        }

        retryTimer.current = setTimeout(() => {
          void checkReady(currentAttempt + 1);
        }, retryDelayMs);
      }
    }

    void checkReady(1);

    return () => {
      cancelled = true;
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
      }
    };
  }, [nextPath]);

  if (timedOut) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-brand-900/40 p-5 text-left">
          <p className="text-sm text-brand-700 leading-7">{statusText}</p>
          <p className="mt-3 text-xs text-brand-700">
            这通常是网络抖动，或者登录状态还没完全同步。您可以先重新尝试进入工作台。
          </p>
        </div>

        <div className="grid gap-3">
          <Button fullWidth size="lg" onClick={() => window.location.assign(nextPath)}>
            重新进入工作台
          </Button>
          <Button fullWidth size="lg" variant="secondary" onClick={() => window.location.assign("/login")}>
            返回登录页
          </Button>
          <Link
            href="/#contact-sales"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gold-500/40 px-5 py-3 text-sm font-medium text-gold-400 transition-colors hover:bg-gold-500/10 hover:text-gold-300"
          >
            联系客服支持团队
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-brand-900/40 p-5 text-left">
        <div className="flex items-center gap-3">
          <LoaderCircle className="h-5 w-5 animate-spin text-gold-400" />
          <p className="text-sm text-brand-700">{statusText}</p>
        </div>
        <p className="mt-3 text-xs text-brand-700">正在为您准备工作台，第 {Math.max(attempts, 1)} 次检查中。</p>
      </div>

      <div className="text-center text-xs text-brand-700">
        如果长时间没有进入工作台，请稍候重试，或联系拼代代客服支持团队。
      </div>
    </div>
  );
}

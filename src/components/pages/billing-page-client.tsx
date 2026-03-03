"use client";

import { Button } from "@/src/components/ui/Button";
import { SupportServicesNote } from "@/src/components/brand/support-services-note";
import { Key, History, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import React, { useEffect, useState } from "react";
import type { BillingHistoryEntry } from "@/src/types/billing";

type BillingPageClientProps = {
  initialQuota: number;
  initialLedger: BillingHistoryEntry[];
};

function formatHistoryTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "刚刚";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai"
  }).format(date).replace(/\//g, "-");
}

export function BillingPageClient({
  initialQuota,
  initialLedger
}: BillingPageClientProps) {
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quota, setQuota] = useState(initialQuota);
  const [ledger, setLedger] = useState(initialLedger);
  const [statusMessage, setStatusMessage] = useState<string>("请输入额度激活码后完成兑换，成功后积分和流水会立刻刷新。");
  const [statusTone, setStatusTone] = useState<"info" | "success" | "error">("info");

  useEffect(() => {
    let cancelled = false;

    async function syncAccountState() {
      try {
        const [walletResponse, ledgerResponse] = await Promise.all([
          fetch("/api/quota/wallet"),
          fetch("/api/quota/ledger")
        ]);
        const walletPayload = await walletResponse.json();
        const ledgerPayload = await ledgerResponse.json();

        if (!cancelled && walletResponse.ok) {
          setQuota(walletPayload.wallet.rechargeQuota);
        }

        if (!cancelled && ledgerResponse.ok) {
          setLedger(ledgerPayload.entries);
        }
      } catch {
        // Keep the server-rendered quota when the sync request fails.
      }
    }

    void syncAccountState();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleRecharge = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code.trim()) {
      setStatusTone("error");
      setStatusMessage("请先输入激活码。");
      return;
    }

    setIsSubmitting(true);
    setStatusTone("info");
    setStatusMessage("正在核对激活码，请稍候...");

    try {
      const response = await fetch("/api/quota/redeem-code", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          code: code.trim()
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        setStatusTone("error");
        setStatusMessage(payload?.message ?? "激活码兑换失败，请稍后再试。");
        return;
      }

      setQuota(payload.currentQuota);
      setCode("");
      try {
        const ledgerResponse = await fetch("/api/quota/ledger");
        const ledgerPayload = await ledgerResponse.json();

        if (ledgerResponse.ok) {
          setLedger(ledgerPayload.entries);
        }
      } catch {
        // Keep the current list if the refresh fails.
      }
      setStatusTone("success");
      setStatusMessage(`激活码兑换成功，已到账 ${payload.creditedQuota} 积分。`);
    } catch {
      setStatusTone("error");
      setStatusMessage("系统繁忙，请稍后再试。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16 container mx-auto px-6 md:px-12 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-cream-50 mb-2">账户额度</h1>
        <p className="text-brand-700">管理您的积分余额与充值记录</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="glass-panel p-8 rounded-2xl border-gold-glow relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gold-500/10 rounded-full blur-3xl" />
            <div className="relative z-10">
              <p className="text-sm font-medium text-cream-100 mb-2">当前可用积分</p>
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-5xl font-bold text-gold-400 font-mono">{quota.toLocaleString("en-US")}</span>
                <span className="text-brand-700">积分</span>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-brand-700">
                <div className="bg-brand-950/50 px-3 py-1.5 rounded-lg border border-white/5">
                  积分按字数计费，任务提交后自动计算
                </div>
              </div>
            </div>
          </div>

          <div className="bg-brand-900/30 p-8 rounded-2xl border border-white/5">
            <h2 className="text-xl font-bold text-cream-50 mb-6 flex items-center gap-2">
              <Key className="w-5 h-5 text-gold-400" />
              激活码兑换
            </h2>

            <form onSubmit={handleRecharge} className="mb-8">
              <div className="flex flex-col sm:flex-row gap-4">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="请输入 16 位额度激活码"
                  required
                  className="flex-grow px-4 py-3 border border-white/10 rounded-xl bg-brand-950 text-cream-50 placeholder-brand-700 focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-transparent font-mono tracking-wider"
                />
                <Button type="submit" disabled={isSubmitting || !code.trim()} className="sm:w-32">
                  {isSubmitting ? "兑换中..." : "立即兑换"}
                </Button>
              </div>
            </form>

            <div
              className={`mb-6 rounded-2xl border px-4 py-4 text-sm leading-6 ${
                statusTone === "success"
                  ? "border-green-500/20 bg-green-500/10 text-green-200"
                  : statusTone === "error"
                    ? "border-brand-500/20 bg-brand-500/10 text-brand-200"
                    : "border-white/5 bg-brand-950/40 text-brand-700"
              }`}
            >
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
                兑换状态
              </p>
              <p>{statusMessage}</p>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-cream-100">激活码规则：</h3>
              <ul className="space-y-2 text-sm text-brand-700 list-disc list-inside">
                <li>每个激活码仅限使用一次，兑换后立即作废。</li>
                <li>同一账号可多次兑换不同激活码，积分永久有效。</li>
                <li>激活码分为 4 档：1000、5000、10000、20000 积分。</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-brand-950 p-6 rounded-2xl border border-white/10 text-center">
            <h3 className="text-lg font-bold text-cream-50 mb-2">获取额度激活码</h3>
            <p className="text-sm text-brand-700 mb-6">请联系客服支持团队购买，支持批量采购。</p>

            <div className="w-40 h-40 bg-white rounded-xl p-2 mx-auto mb-4 flex items-center justify-center overflow-hidden">
              <img src="/qrcode.png" alt="客服微信二维码" className="w-full h-full object-cover rounded-lg" />
            </div>

            <div className="bg-brand-900 px-4 py-2 rounded-lg border border-white/5 inline-block">
              <span className="text-xs text-brand-700 mr-2">微信号：</span>
              <span className="font-mono text-gold-400 text-sm font-medium">pindaidai_vip</span>
            </div>

            <div className="mt-4">
              <SupportServicesNote centered />
            </div>
          </div>

          <div className="bg-brand-900/30 p-6 rounded-2xl border border-white/5">
            <h3 className="text-base font-bold text-cream-50 mb-4 flex items-center gap-2">
              <History className="w-4 h-4 text-brand-700" />
              最近记录
            </h3>

            {ledger.length > 0 ? (
              <div className="space-y-4">
                {ledger.map((record) => (
                  <div key={record.id} className="flex items-center justify-between pb-3 border-b border-white/5 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${record.amount > 0 ? "bg-green-500/10 text-green-400" : "bg-brand-800 text-brand-700"}`}>
                      {record.amount > 0 ? <ArrowUpCircle className="w-4 h-4" /> : <ArrowDownCircle className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-cream-100">{record.title}</p>
                      <p className="text-xs text-brand-700">{formatHistoryTime(record.createdAt)}</p>
                      <p className="text-xs text-brand-700 mt-1">{record.detail}</p>
                    </div>
                  </div>
                  <span className={`font-mono text-sm font-medium ${record.amount > 0 ? "text-green-400" : "text-cream-50"}`}>
                    {record.amount > 0 ? "+" : ""}
                    {record.amount}
                  </span>
                </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/5 bg-brand-950/40 px-4 py-5 text-sm text-brand-700 leading-6">
                您当前还没有积分记录。购买额度激活码后，兑换记录和后续扣费记录都会显示在这里。
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

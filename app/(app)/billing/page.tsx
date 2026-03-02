"use client";

import { Button } from "@/src/components/ui/Button";
import { Key, MessageSquare, History, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import React, { useState } from "react";

export default function Recharge() {
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRecharge = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setCode("");
      alert("激活码兑换成功！");
    }, 1000);
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
                <span className="text-5xl font-bold text-gold-400 font-mono">1,500</span>
                <span className="text-brand-700">积分</span>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-brand-700">
                <div className="bg-brand-950/50 px-3 py-1.5 rounded-lg border border-white/5">
                  生成文章：<span className="text-cream-50 font-mono">500</span> 积分/次
                </div>
                <div className="bg-brand-950/50 px-3 py-1.5 rounded-lg border border-white/5">
                  自动降AI：<span className="text-cream-50 font-mono">500</span> 积分/次
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
                <Button type="submit" disabled={isSubmitting || !code} className="sm:w-32">
                  {isSubmitting ? "兑换中..." : "立即兑换"}
                </Button>
              </div>
            </form>

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
            <p className="text-sm text-brand-700 mb-6">请联系销售团队购买，支持批量采购。</p>

            <div className="w-40 h-40 bg-white rounded-xl p-2 mx-auto mb-4 flex items-center justify-center overflow-hidden">
              <img src="/qrcode.png" alt="客服微信二维码" className="w-full h-full object-cover rounded-lg" />
            </div>

            <div className="bg-brand-900 px-4 py-2 rounded-lg border border-white/5 inline-block">
              <span className="text-xs text-brand-700 mr-2">微信号：</span>
              <span className="font-mono text-gold-400 text-sm font-medium">pindaidai_vip</span>
            </div>
          </div>

          <div className="bg-brand-900/30 p-6 rounded-2xl border border-white/5">
            <h3 className="text-base font-bold text-cream-50 mb-4 flex items-center gap-2">
              <History className="w-4 h-4 text-brand-700" />
              最近记录
            </h3>

            <div className="space-y-4">
              {[
                { type: "consume", title: "生成文章", amount: -500, date: "2023-10-25 14:30" },
                { type: "recharge", title: "激活码兑换", amount: 5000, date: "2023-10-24 09:15" },
                { type: "consume", title: "自动降AI", amount: -500, date: "2023-10-20 16:45" },
                { type: "consume", title: "生成文章", amount: -500, date: "2023-10-20 16:40" }
              ].map((record, i) => (
                <div key={i} className="flex items-center justify-between pb-3 border-b border-white/5 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${record.type === "recharge" ? "bg-green-500/10 text-green-400" : "bg-brand-800 text-brand-700"}`}>
                      {record.type === "recharge" ? <ArrowUpCircle className="w-4 h-4" /> : <ArrowDownCircle className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-cream-100">{record.title}</p>
                      <p className="text-xs text-brand-700">{record.date}</p>
                    </div>
                  </div>
                  <span className={`font-mono text-sm font-medium ${record.type === "recharge" ? "text-green-400" : "text-cream-50"}`}>
                    {record.amount > 0 ? "+" : ""}
                    {record.amount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

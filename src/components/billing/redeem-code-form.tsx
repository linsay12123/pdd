"use client";

import { useState } from "react";

type RedeemCodeFormProps = {
  userId: string;
  onRedeemSuccess: (payload: {
    code: string;
    creditedQuota: number;
    currentQuota: number;
  }) => void;
};

export function RedeemCodeForm({ userId, onRedeemSuccess }: RedeemCodeFormProps) {
  const [code, setCode] = useState("");
  const [statusText, setStatusText] = useState("等待输入激活码");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!code.trim()) {
      setStatusText("请先输入激活码");
      return;
    }

    setSubmitting(true);
    setStatusText("兑换处理中...");

    try {
      const response = await fetch("/api/quota/redeem-code", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          userId,
          code: code.trim()
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        setStatusText(payload?.message ?? "兑换失败，请稍后再试");
        return;
      }

      setStatusText(`兑换成功，已到账 ${payload.creditedQuota} 积分`);
      setCode("");
      onRedeemSuccess({
        code: payload.code,
        creditedQuota: payload.creditedQuota,
        currentQuota: payload.currentQuota
      });
    } catch {
      setStatusText("系统繁忙，请稍后再试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.8rem", marginTop: "1rem" }}>
      <input
        type="text"
        placeholder="请输入你的额度激活码"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        className="pdd-input pdd-mono"
      />
      <button
        type="submit"
        disabled={submitting}
        className="pdd-btn pdd-btn-primary"
        style={{ opacity: submitting ? 0.8 : 1 }}
      >
        {submitting ? "兑换中..." : "立即兑换激活码"}
      </button>
      <div
        className="pdd-card-plain"
        style={{ padding: "10px 12px", lineHeight: 1.6 }}
      >
        <strong>兑换状态</strong>
        <div>{statusText}</div>
      </div>
    </form>
  );
}

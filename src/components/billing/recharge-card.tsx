"use client";

import { useEffect, useState } from "react";
import { ContactSalesCard } from "@/src/components/brand/contact-sales-card";
import { RedeemCodeForm } from "@/src/components/billing/redeem-code-form";

type RechargeCardProps = {
  currentQuota: number;
};

const recordRows = [
  "兑换记录：10000 积分激活码，今天 14:20 到账",
  "消耗记录：生成文章，扣除 500 积分",
  "消耗记录：自动降AI，扣除 500 积分"
];

export function RechargeCard({ currentQuota }: RechargeCardProps) {
  const [quota, setQuota] = useState(currentQuota);

  useEffect(() => {
    let cancelled = false;

    async function syncWallet() {
      try {
        const response = await fetch("/api/quota/wallet");
        const payload = await response.json();
        if (!cancelled && response.ok) {
          setQuota(payload.wallet.rechargeQuota);
        }
      } catch {
        // Keep local number when network fails.
      }
    }

    void syncWallet();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="pdd-grid-2" style={{ alignItems: "start" }}>
      <div className="pdd-list" style={{ gap: "12px" }}>
        <section className="pdd-card" style={{ padding: "18px" }}>
          <h2 style={{ marginTop: 0, marginBottom: "6px" }}>当前可用积分</h2>
          <div className="pdd-mono pdd-highlight" style={{ fontSize: "2.4rem", lineHeight: 1.1 }}>
            {quota} 点
          </div>
          <p className="pdd-sub" style={{ marginTop: "8px" }}>
            现在只保留激活码充值，不展示在线支付。
          </p>
          <div className="pdd-list" style={{ gap: "6px", marginTop: "8px", color: "#475569" }}>
            <span>生成文章固定扣 500 积分</span>
            <span>自动降AI固定扣 500 积分</span>
          </div>
        </section>

        <section className="pdd-card" style={{ padding: "18px" }}>
          <h2 style={{ marginTop: 0, marginBottom: "6px" }}>输入额度激活码</h2>
          <p className="pdd-sub">每个激活码只能用一次。兑换成功后积分实时到账。</p>
          <RedeemCodeForm
            onRedeemSuccess={(payload) => {
              setQuota(payload.currentQuota);
            }}
          />
        </section>

        <section className="pdd-card" style={{ padding: "18px" }}>
          <h2 style={{ marginTop: 0, marginBottom: "8px" }}>固定额度档位</h2>
          <div className="pdd-grid-4">
            {["1000 积分", "5000 积分", "10000 积分", "20000 积分"].map((item) => (
              <div
                key={item}
                className="pdd-card-plain"
                style={{ padding: "12px", textAlign: "center", fontWeight: 800 }}
              >
                {item}
              </div>
            ))}
          </div>
          <div className="pdd-list" style={{ gap: "6px", marginTop: "10px", color: "#475569" }}>
            <span>生成文章固定扣 500 积分</span>
            <span>自动降AI固定扣 500 积分</span>
          </div>
        </section>

        <section className="pdd-card" style={{ padding: "18px" }}>
          <h2 style={{ marginTop: 0, marginBottom: "8px" }}>最近记录</h2>
          <div className="pdd-list">
            {recordRows.map((item) => (
              <div key={item} className="pdd-card-plain" style={{ padding: "10px 12px" }}>
                {item}
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="pdd-list" style={{ gap: "12px" }}>
        <ContactSalesCard
          title="需要购买额度？联系销售团队"
          description="积分不够时，扫码联系销售团队购买新的激活码。一个账号可以反复输入不同激活码。"
        />
      </div>
    </section>
  );
}

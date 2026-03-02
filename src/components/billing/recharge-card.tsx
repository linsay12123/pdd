"use client";

import { useEffect, useState } from "react";
import { ContactSalesCard } from "@/src/components/brand/contact-sales-card";
import { RedeemCodeForm } from "@/src/components/billing/redeem-code-form";

type RechargeCardProps = {
  currentQuota: number;
  userId: string;
};

const cardStyle = {
  padding: "1.4rem",
  borderRadius: "1.4rem",
  border: "1px solid rgba(117, 96, 57, 0.14)",
  background: "rgba(255, 255, 255, 0.9)",
  boxShadow: "0 20px 40px rgba(54, 45, 28, 0.08)"
} as const;

const recordRows = [
  "兑换记录：10000 积分激活码，今天 14:20 到账",
  "消耗记录：生成文章，扣除 500 积分",
  "消耗记录：自动降AI，扣除 500 积分"
];

export function RechargeCard({ currentQuota, userId }: RechargeCardProps) {
  const [quota, setQuota] = useState(currentQuota);

  useEffect(() => {
    let cancelled = false;

    async function syncWallet() {
      try {
        const response = await fetch(
          `/api/quota/wallet?userId=${encodeURIComponent(userId)}`,
          {
            method: "GET"
          }
        );
        const payload = await response.json();

        if (!cancelled && response.ok) {
          setQuota(payload.wallet.rechargeQuota);
        }
      } catch {
        // Keep existing local balance when sync fails.
      }
    }

    void syncWallet();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <section
      style={{
        display: "grid",
        gap: "1rem",
        gridTemplateColumns: "minmax(0, 1.4fr) minmax(280px, 0.9fr)"
      }}
    >
      <div style={{ display: "grid", gap: "1rem" }}>
        <section style={cardStyle}>
          <h2 style={{ marginTop: 0, marginBottom: "0.5rem" }}>当前账户积分</h2>
          <div
            style={{
              fontSize: "2.2rem",
              fontWeight: 700,
              marginBottom: "0.75rem"
            }}
          >
            {quota} 点
          </div>
          <p style={{ marginTop: 0, marginBottom: 0, lineHeight: 1.7, color: "#584e3d" }}>
            现在先按激活码充值模式处理，不展示任何在线支付方式。
          </p>
        </section>

        <section style={cardStyle}>
          <h2 style={{ marginTop: 0, marginBottom: "0.5rem" }}>输入额度激活码</h2>
          <p style={{ marginTop: 0, lineHeight: 1.7, color: "#584e3d" }}>
            每个额度激活码只能使用一次。兑换成功后，积分会直接加到当前账户。
          </p>
          <RedeemCodeForm
            userId={userId}
            onRedeemSuccess={(payload) => {
              setQuota(payload.currentQuota);
            }}
          />
        </section>

        <section style={cardStyle}>
          <h2 style={{ marginTop: 0, marginBottom: "0.75rem" }}>固定额度档位</h2>
          <div
            style={{
              display: "grid",
              gap: "0.8rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))"
            }}
          >
            {["1000 积分", "5000 积分", "10000 积分", "20000 积分"].map((item) => (
              <div
                key={item}
                style={{
                  padding: "0.95rem",
                  borderRadius: "1rem",
                  background: "#fff9ee",
                  border: "1px solid rgba(117, 96, 57, 0.1)",
                  textAlign: "center",
                  fontWeight: 700
                }}
              >
                {item}
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: "1rem",
              display: "grid",
              gap: "0.4rem",
              color: "#4e4538"
            }}
          >
            <span>生成文章固定扣 500 积分</span>
            <span>自动降AI固定扣 500 积分</span>
          </div>
        </section>

        <section style={cardStyle}>
          <h2 style={{ marginTop: 0, marginBottom: "0.75rem" }}>最近记录</h2>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {recordRows.map((item) => (
              <div
                key={item}
                style={{
                  padding: "0.9rem",
                  borderRadius: "1rem",
                  background: "#fffaf2",
                  border: "1px solid rgba(117, 96, 57, 0.08)",
                  lineHeight: 1.7
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </section>
      </div>

      <div style={{ display: "grid", alignContent: "start" }}>
        <ContactSalesCard
          title="需要购买额度？联系销售团队"
          description="如果积分不够，直接扫码联系销售团队购买新的激活码。后续你可以继续输入新的码，反复给同一个账号充值。"
        />
      </div>
    </section>
  );
}

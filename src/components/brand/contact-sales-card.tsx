import { BrandLogo } from "./brand-logo";

type ContactSalesCardProps = {
  title?: string;
  description?: string;
};

export function ContactSalesCard({
  title = "联系客服购买额度",
  description = "需要补充积分时，直接扫码联系销售团队获取一次性激活码。激活码只能使用一次，但同一个账号可以多次兑换不同激活码。"
}: ContactSalesCardProps) {
  return (
    <section
      aria-label="sales-contact-card"
      style={{
        display: "grid",
        gap: "1rem",
        padding: "1.25rem",
        borderRadius: "1.5rem",
        background: "linear-gradient(135deg, #fff8ea 0%, #f6eee2 100%)",
        border: "1px solid rgba(134, 111, 72, 0.18)",
        boxShadow: "0 18px 40px rgba(52, 44, 31, 0.08)"
      }}
    >
      <BrandLogo />
      <div style={{ display: "grid", gap: "0.5rem" }}>
        <strong style={{ fontSize: "1.05rem" }}>{title}</strong>
        <p
          style={{
            margin: 0,
            lineHeight: 1.7,
            color: "#534a3c"
          }}
        >
          {description}
        </p>
      </div>
      <div
        style={{
          display: "grid",
          justifyItems: "center",
          gap: "0.75rem",
          padding: "1rem",
          borderRadius: "1.25rem",
          background: "#ffffff"
        }}
      >
        <img
          src="/qrcode.jpg"
          alt="拼代代PDD 客服二维码"
          width={176}
          height={176}
          style={{
            width: "100%",
            maxWidth: "176px",
            borderRadius: "1rem",
            objectFit: "cover"
          }}
        />
        <span style={{ fontSize: "0.9rem", color: "#6d624f" }}>扫码直连销售团队</span>
      </div>
    </section>
  );
}

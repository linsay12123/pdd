import { BrandLogo } from "./brand-logo";
import { SupportServicesNote } from "./support-services-note";

type ContactSalesCardProps = {
  title?: string;
  description?: string;
};

export function ContactSalesCard({
  title = "联系客服支持团队购买额度",
  description = "需要补充积分时，直接扫码联系客服支持团队获取一次性激活码。激活码只能使用一次，但同一个账号可以多次兑换不同激活码。"
}: ContactSalesCardProps) {
  return (
    <section aria-label="support-contact-card" className="pdd-card" style={{ display: "grid", gap: "1rem", padding: "1.25rem" }}>
      <BrandLogo />
      <div style={{ display: "grid", gap: "0.5rem" }}>
        <strong style={{ fontSize: "1.05rem" }}>{title}</strong>
        <p style={{ margin: 0, lineHeight: 1.7, color: "#475569" }}>
          {description}
        </p>
      </div>
      <SupportServicesNote />
      <div
        className="pdd-card-plain"
        style={{ display: "grid", justifyItems: "center", gap: "0.75rem", padding: "1rem" }}
      >
        <img
          src="/qrcode.jpg"
          alt="拼代代PDD 客服二维码"
          width={176}
          height={176}
          style={{
            width: "100%",
            maxWidth: "176px",
            borderRadius: "0.9rem",
            objectFit: "cover"
          }}
        />
        <span style={{ fontSize: "0.9rem", color: "#64748b" }}>扫码直连客服支持团队</span>
      </div>
    </section>
  );
}

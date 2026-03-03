type SupportServicesNoteProps = {
  centered?: boolean;
};

export function SupportServicesNote({
  centered = false
}: SupportServicesNoteProps) {
  return (
    <div
      className="pdd-card-plain"
      style={{
        display: "grid",
        gap: "0.45rem",
        padding: "0.85rem 0.95rem",
        textAlign: centered ? "center" : "left"
      }}
    >
      <p style={{ margin: 0, color: "#475569", lineHeight: 1.6, fontSize: "0.88rem" }}>
        如需要 AI 检测报告、查重报告，请联系客服支持团队。
      </p>
      <p style={{ margin: 0, color: "#475569", lineHeight: 1.6, fontSize: "0.88rem" }}>
        如需要学术诚信风险检测报告，也请联系客服支持团队协助处理。
      </p>
    </div>
  );
}

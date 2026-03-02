type ManualHumanizeCardProps = {
  imageSrc?: string;
  contactText?: string;
};

export function ManualHumanizeCard({
  imageSrc = "/qrcode.jpg",
  contactText = "人工降AI 请联系客服"
}: ManualHumanizeCardProps) {
  return (
    <aside
      style={{
        marginTop: "12px",
        padding: "12px",
        borderRadius: "14px",
        border: "1px solid #d7cfbe",
        background: "#f6efe0",
        display: "grid",
        gap: "10px",
        justifyItems: "center"
      }}
    >
      <img
        src={imageSrc}
        alt="微信客服二维码"
        width={120}
        height={120}
        style={{ borderRadius: "12px", background: "#ffffff", padding: "6px" }}
      />
      <strong>{contactText}</strong>
      <p style={{ margin: 0, textAlign: "center", color: "#57492c" }}>
        如果你想做更强的人工作业润色，可以扫码联系人工服务。
      </p>
    </aside>
  );
}

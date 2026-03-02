type BrandLogoProps = {
  variant?: "compact" | "large";
};

export function BrandLogo({ variant = "compact" }: BrandLogoProps) {
  const imageSize = variant === "large" ? 56 : 40;
  const titleSize = variant === "large" ? "1.25rem" : "1rem";
  const subtitleSize = variant === "large" ? "0.8rem" : "0.72rem";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.75rem"
      }}
    >
      <img
        src="/logo.jpg"
        alt="拼代代PDD logo"
        width={imageSize}
        height={imageSize}
        style={{
          borderRadius: "0.9rem",
          boxShadow: "0 10px 24px rgba(18, 24, 38, 0.14)",
          objectFit: "cover"
        }}
      />
      <div style={{ display: "grid", gap: "0.2rem" }}>
        <strong
          style={{
            fontSize: titleSize,
            lineHeight: 1.1,
            letterSpacing: "0.02em"
          }}
        >
          拼代代PDD
        </strong>
        <span
          style={{
            fontSize: subtitleSize,
            color: "#5b5345"
          }}
        >
          Pin Dai Dai PDD
        </span>
      </div>
    </div>
  );
}

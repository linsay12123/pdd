export function SpecialRequirementsField() {
  return (
    <section
      style={{
        padding: "20px",
        border: "1px solid #d7cfbe",
        borderRadius: "16px",
        background: "rgba(255, 255, 255, 0.82)"
      }}
    >
      <h2 style={{ marginTop: 0 }}>特殊要求</h2>
      <p style={{ marginTop: 0 }}>
        这里给用户填写行业方向、课程重点、分析偏好等额外要求。
      </p>
      <div
        style={{
          minHeight: "96px",
          borderRadius: "12px",
          background: "#f6f1e8",
          border: "1px solid #e0d5c2",
          padding: "12px"
        }}
      >
        输入框占位区
      </div>
    </section>
  );
}

import { ManualHumanizeCard } from "@/src/components/workspace/manual-humanize-card";

type DeliverablesPanelProps = {
  finalDocxHref?: string;
  referenceReportHref?: string;
  humanizedDocxHref?: string;
};

function DownloadLink({
  href,
  label
}: {
  href: string;
  label: string;
}) {
  return (
    <a
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "40px",
        padding: "0 14px",
        borderRadius: "12px",
        border: "1px solid #9d8252",
        color: "#4d3519",
        textDecoration: "none",
        background: "#fff8eb",
        fontWeight: 600
      }}
    >
      {label}
    </a>
  );
}

export function DeliverablesPanel({
  finalDocxHref,
  referenceReportHref,
  humanizedDocxHref
}: DeliverablesPanelProps = {}) {
  const hasPrimaryDeliverables = Boolean(finalDocxHref || referenceReportHref);

  return (
    <section
      style={{
        padding: "20px",
        border: "1px solid #d7cfbe",
        borderRadius: "16px",
        background: "rgba(255, 255, 255, 0.82)"
      }}
    >
      <h2 style={{ marginTop: 0 }}>交付结果</h2>
      <p style={{ marginTop: 0, marginBottom: "8px" }}>
        这里将显示最终版文章、核验报告和后续的降 AI 结果。
      </p>
      {!hasPrimaryDeliverables ? (
        <div>下载按钮区（占位）</div>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {finalDocxHref ? (
              <DownloadLink
                href={finalDocxHref}
                label="最终版文章（Word）"
              />
            ) : null}
            {referenceReportHref ? (
              <DownloadLink
                href={referenceReportHref}
                label="核验报告（PDF）"
              />
            ) : null}
            <button
              type="button"
              style={{
                minHeight: "40px",
                padding: "0 14px",
                borderRadius: "12px",
                border: "1px solid #4d3519",
                background: "#4d3519",
                color: "#fff7e8",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              自动降AI
            </button>
          </div>

          {humanizedDocxHref ? (
            <div style={{ display: "grid", gap: "8px" }}>
              <DownloadLink
                href={humanizedDocxHref}
                label="降AI后版本（Word）"
              />
              <ManualHumanizeCard />
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

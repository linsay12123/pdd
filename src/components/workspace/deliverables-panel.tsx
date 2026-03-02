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
      className="pdd-btn pdd-btn-secondary"
      style={{ minHeight: "38px", padding: "0 14px" }}
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
    <section className="pdd-card" style={{ padding: "18px" }}>
      <h2 style={{ marginTop: 0 }}>交付结果</h2>
      <p className="pdd-sub" style={{ marginBottom: "8px" }}>
        这里将显示最终版文章、核验报告和后续的降 AI 结果。
      </p>
      {!hasPrimaryDeliverables ? (
        <div className="pdd-card-plain" style={{ padding: "14px", color: "#64748b" }}>
          下载按钮区（占位）
        </div>
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
              className="pdd-btn pdd-btn-primary"
              style={{ minHeight: "38px", padding: "0 14px" }}
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

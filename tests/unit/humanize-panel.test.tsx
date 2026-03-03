import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DeliverablesPanel } from "../../src/components/workspace/deliverables-panel";

describe("DeliverablesPanel humanize state", () => {
  it("shows the auto-humanize action after the final article exists", () => {
    const html = renderToStaticMarkup(
      <DeliverablesPanel
        finalDocxHref="/downloads/final.docx"
        referenceReportHref="/downloads/report.pdf"
      />
    );

    expect(html).toContain("最终版文章（Word）");
    expect(html).toContain("核验报告（PDF）");
    expect(html).toContain("自动降AI");
    expect(html).not.toContain("人工降AI 请联系客服");
  });

  it("shows the manual service card only after the humanized file exists", () => {
    const html = renderToStaticMarkup(
      <DeliverablesPanel
        finalDocxHref="/downloads/final.docx"
        referenceReportHref="/downloads/report.pdf"
        humanizedDocxHref="/downloads/humanized.docx"
      />
    );

    expect(html).toContain("降AI后版本（Word）");
    expect(html).toContain("人工降AI 请联系客服");
    expect(html).toContain("/qrcode.jpg");
    expect(html).toContain("AI 检测报告");
  });
});

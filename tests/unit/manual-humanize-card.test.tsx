import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ManualHumanizeCard } from "../../src/components/workspace/manual-humanize-card";

describe("ManualHumanizeCard", () => {
  it("keeps the QR code and support note in the homepage style support card", () => {
    const html = renderToStaticMarkup(<ManualHumanizeCard />);

    expect(html).toContain("人工降AI 请联系客服");
    expect(html).toContain("/qrcode.jpg");
    expect(html).toContain("AI 检测报告");
    expect(html).toContain("客服");
  });
});

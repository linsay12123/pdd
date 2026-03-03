import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BrandLogo } from "../../src/components/brand/brand-logo";
import { ContactSalesCard } from "../../src/components/brand/contact-sales-card";

describe("brand components", () => {
  it("renders the pindaidai logo and brand name", () => {
    const html = renderToStaticMarkup(<BrandLogo />);

    expect(html).toContain("拼代代PDD");
    expect(html).toContain('src="/logo.jpg"');
  });

  it("renders the sales qr code card", () => {
    const html = renderToStaticMarkup(<ContactSalesCard />);

    expect(html).toContain("联系客服支持团队购买额度");
    expect(html).toContain('src="/qrcode.jpg"');
    expect(html).toContain("激活码");
    expect(html).toContain("AI 检测报告");
    expect(html).toContain("学术诚信风险检测报告");
  });
});

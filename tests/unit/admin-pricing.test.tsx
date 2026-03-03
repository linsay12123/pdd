import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

describe("admin pricing", () => {
  it("renders the real fixed quota rules instead of fake editable pricing rows", async () => {
    const { PricingEditor } = await import("../../src/components/admin/pricing-editor");
    const html = renderToStaticMarkup(<PricingEditor />);

    expect(html).toContain("积分规则");
    expect(html).toContain("生成文章");
    expect(html).toContain("自动降AI");
    expect(html).toContain("当前固定扣点");
    expect(html).toContain("500 点");
    expect(html).not.toContain("修改扣点");
    expect(html).not.toContain("生成新激活码");
  });
});

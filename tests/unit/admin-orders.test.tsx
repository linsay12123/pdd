import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

describe("admin orders", () => {
  it("renders the real activation code operations panel instead of mock rows", async () => {
    const { OrderTable } = await import("../../src/components/admin/order-table");
    const html = renderToStaticMarkup(<OrderTable />);

    expect(html).toContain("激活码管理");
    expect(html).toContain("生成新激活码");
    expect(html).toContain("导出CSV");
    expect(html).toContain("按激活码关键词搜索");
    expect(html).not.toContain("client-a@example.com");
    expect(html).not.toContain("PDD-5000-CE28B441");
  });
});

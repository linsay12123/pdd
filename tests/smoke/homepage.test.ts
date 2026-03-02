import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import HomePage from "../../app/page";

describe("HomePage", () => {
  it("renders the branded sales homepage", () => {
    const html = renderToStaticMarkup(createElement(HomePage));

    expect(html).toContain("批量处理，稳定交付。");
    expect(html).toContain("联系销售购买额度");
    expect(html).toContain("激活码按需充值");
    expect(html).toContain("生成文章需500积分");
  });
});

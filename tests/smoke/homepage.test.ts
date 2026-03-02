import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import HomePage from "../../app/page";

describe("HomePage", () => {
  it("renders the branded sales homepage", () => {
    const html = renderToStaticMarkup(createElement(HomePage));

    expect(html).toContain("拼代代PDD");
    expect(html).toContain("联系客服购买额度");
    expect(html).toContain("激活码");
    expect(html).toContain("生成文章固定扣 500 积分");
  });
});

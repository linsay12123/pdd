import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AppLayout from "../../app/(app)/layout";

describe("AppLayout", () => {
  it("uses the new pindaidai quota wording", () => {
    const html = renderToStaticMarkup(
      createElement(AppLayout, {
        children: createElement("div", null, "内容占位")
      })
    );

    expect(html).toContain("拼代代PDD");
    expect(html).toContain("额度中心");
    expect(html).toContain("当前积分");
    expect(html).not.toContain("订阅额度");
    expect(html).not.toContain("Auto Writing");
  });
});

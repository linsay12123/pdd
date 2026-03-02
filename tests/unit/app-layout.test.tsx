import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AppLayout from "../../app/(app)/layout";

describe("AppLayout", () => {
  it("passes through children in app route group layout", () => {
    const html = renderToStaticMarkup(
      createElement(AppLayout, {
        children: createElement("div", null, "内容占位")
      })
    );

    expect(html).toContain("内容占位");
  });
});

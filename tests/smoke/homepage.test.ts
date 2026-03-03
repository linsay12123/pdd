import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import HomePage from "../../app/page";

describe("HomePage", () => {
  it("renders the branded support homepage", () => {
    const html = renderToStaticMarkup(createElement(HomePage));

    expect(html).toContain("批量处理，稳定交付。");
    expect(html).toContain("联系客服支持团队购买额度");
    expect(html).toContain("激活码按需充值");
    expect(html).toContain("生成文章需500积分");
    expect(html).toContain("AI 检测报告");
  });

  it("documents the current pdd scope without claiming online payments are active", () => {
    const rootDir = path.resolve(__dirname, "../..");
    const readme = readFileSync(path.join(rootDir, "README.md"), "utf8");
    const checklist = readFileSync(
      path.join(rootDir, "docs/runbooks/launch-checklist.md"),
      "utf8"
    );

    expect(readme).toContain("拼代代PDD");
    expect(readme).toContain("当前优先补完");
    expect(readme).toContain("真实登录");
    expect(readme).not.toContain("你现在能直接用的功能");
    expect(checklist).toContain("在线支付已关闭");
    expect(checklist).toContain("当前上线前必须先完成真实登录");
  });
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LoginPage from "../../app/login/page";
import RegisterPage from "../../app/register/page";

describe("auth pages", () => {
  it("renders the branded login page", async () => {
    const page = await LoginPage({});
    const html = renderToStaticMarkup(page);

    expect(html).toContain("欢迎回来");
    expect(html).toContain("登录拼代代");
    expect(html).toContain("立即注册");
    expect(html).toContain("客服支持团队");
  });

  it("renders the branded register page", () => {
    const html = renderToStaticMarkup(createElement(RegisterPage));

    expect(html).toContain("注册拼代代");
    expect(html).toContain("额度激活码");
    expect(html).toContain("注册账号");
    expect(html).toContain("去邮箱点击确认邮件");
  });
});

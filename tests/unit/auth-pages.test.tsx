import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LoginPage from "../../app/login/page";
import RegisterPage from "../../app/register/page";

describe("auth pages", () => {
  it("renders the branded login page", async () => {
    const html = renderToStaticMarkup(createElement(LoginPage));

    expect(html).toContain("欢迎回来");
    expect(html).toContain("登录拼代代");
    expect(html).toContain("立即注册");
  });

  it("renders the branded register page", () => {
    const html = renderToStaticMarkup(createElement(RegisterPage));

    expect(html).toContain("注册拼代代");
    expect(html).toContain("额度激活码");
    expect(html).toContain("注册并进入工作台");
  });
});

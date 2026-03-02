import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LoginPage from "../../app/login/page";
import RegisterPage from "../../app/register/page";

describe("auth pages", () => {
  it("renders the branded login page", async () => {
    const html = renderToStaticMarkup(
      await LoginPage({
        searchParams: Promise.resolve({
          redirect: "/workspace"
        })
      })
    );

    expect(html).toContain("拼代代PDD");
    expect(html).toContain("登录后可继续创建和交付任务");
    expect(html).toContain("注册新账号");
  });

  it("renders the branded register page", () => {
    const html = renderToStaticMarkup(createElement(RegisterPage));

    expect(html).toContain("注册拼代代PDD");
    expect(html).toContain("注册后可长期使用账号");
    expect(html).toContain("额度激活码");
  });
});

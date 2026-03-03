import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthCompletePage from "../../app/auth/complete/page";
import ForgotPasswordPage from "../../app/forgot-password/page";
import LoginPage from "../../app/login/page";
import RegisterPage from "../../app/register/page";
import WorkspaceEntryPage from "../../app/workspace-entry/page";

vi.mock("next/headers", () => ({
  cookies: vi.fn()
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  })
}));

vi.mock("../../src/lib/auth/current-user", () => ({
  getCurrentSessionUserResolution: vi.fn()
}));

beforeEach(async () => {
  const { cookies } = await import("next/headers");
  const { getCurrentSessionUserResolution } = await import("../../src/lib/auth/current-user");

  vi.mocked(cookies).mockResolvedValue({
    getAll: () => [{ name: "sb-test-auth-token", value: "1" }]
  } as never);
  vi.mocked(getCurrentSessionUserResolution).mockResolvedValue({
    status: "anonymous"
  });
});

describe("auth pages", () => {
  it("renders the branded login page", async () => {
    const page = await LoginPage({});
    const html = renderToStaticMarkup(page);

    expect(html).toContain("欢迎回来");
    expect(html).toContain("登录拼代代");
    expect(html).toContain("立即注册");
    expect(html).toContain("忘记密码？");
    expect(html).toContain("客服支持团队");
  });

  it("renders the branded register page", () => {
    const html = renderToStaticMarkup(createElement(RegisterPage));

    expect(html).toContain("注册拼代代");
    expect(html).toContain("额度激活码");
    expect(html).toContain("注册账号");
    expect(html).not.toContain("去邮箱点击确认邮件");
    expect(html).not.toContain("重新发送确认邮件");
  });

  it("renders the forgot-password page", async () => {
    const page = await ForgotPasswordPage({});
    const html = renderToStaticMarkup(page);

    expect(html).toContain("找回密码");
    expect(html).toContain("发送重置密码邮件");
  });

  it("renders the branded auth-complete page", async () => {
    const page = await AuthCompletePage({});
    const html = renderToStaticMarkup(page);

    expect(html).toContain("登录成功，正在进入工作台");
    expect(html).toContain("联系客服支持团队");
  });

  it("redirects anonymous users from workspace-entry back to login", async () => {
    await expect(WorkspaceEntryPage({})).rejects.toThrow(
      "NEXT_REDIRECT:/login?redirect=%2Fworkspace"
    );
  });

  it("redirects profile-missing users from workspace-entry into auth-complete", async () => {
    const { getCurrentSessionUserResolution } = await import("../../src/lib/auth/current-user");
    vi.mocked(getCurrentSessionUserResolution).mockResolvedValue({
      status: "profile_missing",
      authUserId: "user-3",
      email: "user@example.com"
    });

    await expect(WorkspaceEntryPage({})).rejects.toThrow(
      "NEXT_REDIRECT:/auth/complete?next=%2Fworkspace"
    );
  });
});

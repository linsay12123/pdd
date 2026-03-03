import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ForgotPasswordPage from "../../app/forgot-password/page";
import ResetPasswordPage from "../../app/reset-password/page";
import { handleAuthConfirmRequest } from "../../app/auth/confirm/route";
import {
  buildPasswordResetEmailRedirectTo,
  getPasswordResetCompletionMessage,
  getPasswordResetLinkErrorMessage
} from "../../src/lib/auth/password-reset-flow";

describe("password reset pages", () => {
  it("renders the forgot-password page", async () => {
    const page = await ForgotPasswordPage({});
    const html = renderToStaticMarkup(page);

    expect(html).toContain("找回密码");
    expect(html).toContain("发送重置密码邮件");
  });

  it("renders the reset-password page", async () => {
    const page = await ResetPasswordPage({});
    const html = renderToStaticMarkup(page);

    expect(html).toContain("重设密码");
    expect(html).toContain("保存新密码");
  });
});

describe("password reset helpers", () => {
  it("builds a production-safe recovery redirect", () => {
    expect(buildPasswordResetEmailRedirectTo("https://pindaidai.vercel.app")).toBe(
      "https://pindaidai.vercel.app/auth/confirm?next=%2Freset-password"
    );
  });

  it("uses a generic success message for reset emails", () => {
    expect(getPasswordResetCompletionMessage()).toContain("如果这个邮箱已经注册");
  });

  it("returns a readable reset-link error", () => {
    expect(getPasswordResetLinkErrorMessage()).toContain("重置密码链接");
  });
});

describe("recovery confirmation route", () => {
  it("routes recovery links back to the reset-password page", async () => {
    const response = await handleAuthConfirmRequest(
      new Request("https://pindaidai.vercel.app/auth/confirm?token_hash=abc&type=recovery"),
      {
        verifyOtp: vi.fn().mockResolvedValue({ error: null }),
        createClient: async () =>
          ({ auth: { verifyOtp: vi.fn(), exchangeCodeForSession: vi.fn() } }) as never
      }
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://pindaidai.vercel.app/reset-password");
  });
});

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  getRegisterCompletionMessage,
  buildSignupEmailRedirectTo
} from "../../src/lib/auth/register-flow";
import { handleAuthConfirmRequest } from "../../app/auth/confirm/route";
import Navbar from "../../src/components/layout/Navbar";
import Footer from "../../src/components/layout/Footer";
import LoginPage from "../../app/login/page";

vi.mock("next/navigation", () => ({
  usePathname: () => "/register"
}));

describe("register flow", () => {
  it("moves the user into the workspace when signup finishes", () => {
    expect(getRegisterCompletionMessage({
      email: "user@example.com",
      hasSession: true
    })).toContain("进入工作台");
  });

  it("builds a production-safe confirmation redirect", () => {
    expect(buildSignupEmailRedirectTo("https://pindaidai.vercel.app")).toBe(
      "https://pindaidai.vercel.app/auth/confirm?next=%2Fworkspace"
    );
  });
});

describe("auth confirm route", () => {
  it("redirects to workspace after successful token exchange", async () => {
    const response = await handleAuthConfirmRequest(
      new Request("https://pindaidai.vercel.app/auth/confirm?code=test-code"),
      {
        exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
        createClient: async () => ({ auth: { verifyOtp: vi.fn(), exchangeCodeForSession: vi.fn() } }) as never
      }
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://pindaidai.vercel.app/workspace");
  });

  it("redirects to login with a readable error when verification fails", async () => {
    const response = await handleAuthConfirmRequest(
      new Request("https://pindaidai.vercel.app/auth/confirm?token_hash=abc&type=email"),
      {
        verifyOtp: vi.fn().mockResolvedValue({ error: new Error("expired") }),
        createClient: async () => ({ auth: { verifyOtp: vi.fn(), exchangeCodeForSession: vi.fn() } }) as never
      }
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login?message=");
  });
});

describe("support entrypoints", () => {
  it("uses the homepage contact anchor from the navbar on inner pages", () => {
    const html = renderToStaticMarkup(<Navbar />);

    expect(html).toContain('href="/#contact-sales"');
    expect(html).toContain("客服支持团队");
  });

  it("routes navbar workspace entry through the safe workspace-entry page", () => {
    const html = renderToStaticMarkup(<Navbar />);

    expect(html).toContain('href="/workspace-entry?next=%2Fworkspace"');
  });

  it("uses the homepage contact anchor from the footer", () => {
    const html = renderToStaticMarkup(<Footer />);

    expect(html).toContain('href="/#contact-sales"');
    expect(html).toContain("客服支持团队");
  });

  it("routes footer workspace entry through the safe workspace-entry page", () => {
    const html = renderToStaticMarkup(<Footer />);

    expect(html).toContain('href="/workspace-entry?next=%2Fworkspace"');
  });

  it("shows support-team wording on the login page", async () => {
    const page = await LoginPage({});
    const html = renderToStaticMarkup(page);

    expect(html).toContain("客服支持团队");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import WorkspacePage from "../../app/(app)/workspace/page";

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

vi.mock("../../src/lib/payments/current-wallet", () => ({
  getCurrentSessionWallet: vi.fn()
}));

describe("workspace server page", () => {
  beforeEach(async () => {
    const { cookies } = await import("next/headers");
    const { getCurrentSessionUserResolution } = await import("../../src/lib/auth/current-user");
    const { getCurrentSessionWallet } = await import("../../src/lib/payments/current-wallet");

    vi.mocked(cookies).mockResolvedValue({
      getAll: () => [{ name: "sb-test-auth-token", value: "1" }]
    } as never);

    vi.mocked(getCurrentSessionUserResolution).mockResolvedValue({
      status: "ready",
      user: {
        id: "user-1",
        email: "user@example.com",
        role: "user"
      }
    });

    vi.mocked(getCurrentSessionWallet).mockResolvedValue({
      user: {
        id: "user-1",
        email: "user@example.com",
        role: "user"
      },
      wallet: {
        rechargeQuota: 500,
        subscriptionQuota: 0,
        frozenQuota: 0
      }
    });
  });

  it("sends auth-required users with session traces into auth-complete instead of white-screening", async () => {
    const { getCurrentSessionWallet } = await import("../../src/lib/payments/current-wallet");
    vi.mocked(getCurrentSessionWallet).mockRejectedValue(new Error("AUTH_REQUIRED"));

    await expect(WorkspacePage()).rejects.toThrow(
      "NEXT_REDIRECT:/auth/complete?next=%2Fworkspace"
    );
  });

  it("sends fully anonymous users back to login instead of white-screening", async () => {
    const { cookies } = await import("next/headers");
    const { getCurrentSessionWallet } = await import("../../src/lib/payments/current-wallet");
    vi.mocked(cookies).mockResolvedValue({
      getAll: () => []
    } as never);
    vi.mocked(getCurrentSessionWallet).mockRejectedValue(new Error("AUTH_REQUIRED"));

    await expect(WorkspacePage()).rejects.toThrow("NEXT_REDIRECT:/login?redirect=%2Fworkspace");
  });
});

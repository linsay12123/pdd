import { beforeEach, describe, expect, it } from "vitest";
import { handleQuotaWalletRequest } from "../../app/api/quota/wallet/route";
import { resetPaymentState, seedUserWallet } from "../../src/lib/payments/repository";

describe("quota wallet route", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    resetPaymentState();
  });

  it("returns 401 when user context is missing", async () => {
    const response = await handleQuotaWalletRequest(new Request("http://localhost/api/quota/wallet", {
      method: "GET"
    }), {
      requireUser: async () => {
        throw new Error("AUTH_REQUIRED");
      }
    });
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.message).toContain("登录");
  });

  it("returns wallet snapshot for known user", async () => {
    seedUserWallet("user-7", {
      rechargeQuota: 3200,
      subscriptionQuota: 0,
      frozenQuota: 500
    });

    const response = await handleQuotaWalletRequest(new Request("http://localhost/api/quota/wallet?userId=someone-else", {
      method: "GET",
      headers: {
        "x-user-id": "another-user"
      }
    }), {
      requireUser: async () => ({
        id: "user-7",
        email: "user7@example.com",
        role: "user"
      })
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.userId).toBe("user-7");
    expect(payload.wallet).toEqual({
      rechargeQuota: 3200,
      frozenQuota: 500
    });
  });
});

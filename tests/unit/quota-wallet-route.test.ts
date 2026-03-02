import { beforeEach, describe, expect, it } from "vitest";
import { GET as getQuotaWallet } from "../../app/api/quota/wallet/route";
import { resetPaymentState, seedUserWallet } from "../../src/lib/payments/repository";

describe("quota wallet route", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    resetPaymentState();
  });

  it("returns 401 when user context is missing", async () => {
    const response = await getQuotaWallet(
      new Request("http://localhost/api/quota/wallet", {
        method: "GET"
      })
    );
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

    const response = await getQuotaWallet(
      new Request("http://localhost/api/quota/wallet", {
        method: "GET",
        headers: {
          "x-user-id": "user-7"
        }
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.wallet).toEqual({
      rechargeQuota: 3200,
      frozenQuota: 500
    });
  });
});

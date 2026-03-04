import { describe, expect, it } from "vitest";
import { handleQuotaWalletRequest } from "../../app/api/quota/wallet/route";

describe("quota wallet route", () => {
  it("returns 401 when user context is missing", async () => {
    const response = await handleQuotaWalletRequest(
      new Request("http://localhost/api/quota/wallet", {
        method: "GET"
      }),
      {
        requireUser: async () => {
          throw new Error("AUTH_REQUIRED");
        }
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.message).toContain("登录");
  });

  it("returns wallet snapshot for the signed-in user from the real database path", async () => {
    const response = await handleQuotaWalletRequest(
      new Request("http://localhost/api/quota/wallet?userId=someone-else", {
        method: "GET",
        headers: {
          "x-user-id": "another-user"
        }
      }),
      {
        requireUser: async () => ({
          id: "11111111-1111-4111-8111-111111111111",
          email: "user7@example.com",
          role: "user"
        }),
        shouldUseSupabase: () => true,
        getSupabaseWallet: async () => ({
          rechargeQuota: 3200,
          subscriptionQuota: 0,
          frozenQuota: 500
        })
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.userId).toBe("11111111-1111-4111-8111-111111111111");
    expect(payload.wallet).toEqual({
      rechargeQuota: 3200,
      frozenQuota: 500
    });
  });

  it("returns 503 instead of silently reading fake local quota when the real database is unavailable", async () => {
    const response = await handleQuotaWalletRequest(
      new Request("http://localhost/api/quota/wallet", {
        method: "GET"
      }),
      {
        requireUser: async () => ({
          id: "11111111-1111-4111-8111-111111111111",
          email: "user7@example.com",
          role: "user"
        }),
        shouldUseSupabase: () => false
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.message).toContain("正式积分数据库");
  });
});

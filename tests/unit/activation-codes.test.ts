import { beforeEach, describe, expect, it } from "vitest";
import {
  createActivationCodes,
  listActivationCodes,
  resetActivationCodeState
} from "../../src/lib/activation-codes/repository";
import { redeemActivationCode } from "../../src/lib/activation-codes/redeem-activation-code";
import { getUserWallet, resetPaymentState } from "../../src/lib/payments/repository";
import { handleRedeemCodeRequest } from "../../app/api/quota/redeem-code/route";

describe("activation codes", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    resetActivationCodeState();
    resetPaymentState();
  });

  it("generates random activation codes and redeems them only once", () => {
    const [firstCode, secondCode] = createActivationCodes({
      tier: 1000,
      count: 2
    });

    expect(firstCode.code).not.toBe(secondCode.code);
    expect(firstCode.usedByUserId).toBeNull();
    expect(firstCode.usedByEmail).toBeNull();

    const firstRedeem = redeemActivationCode({
      code: firstCode.code,
      userId: "user-1"
    });

    expect(firstRedeem.wallet.rechargeQuota).toBe(1000);
    expect(firstRedeem.redemption.usedByUserId).toBe("user-1");
    expect(() =>
      redeemActivationCode({
        code: firstCode.code,
        userId: "user-2"
      })
    ).toThrow("已经被使用");
  });

  it("redeems an activation code through the api route", async () => {
    const [code] = createActivationCodes({
      tier: 5000,
      count: 1
    });

    const response = await handleRedeemCodeRequest(new Request("http://localhost/api/quota/redeem-code", {
      method: "POST",
      body: JSON.stringify({
        userId: "user-from-page-should-be-ignored",
        code: code.code
      }),
      headers: {
        "content-type": "application/json"
      }
    }), {
      requireUser: async () => ({
        id: "11111111-1111-4111-8111-111111111119",
        email: "user9@example.com",
        role: "user"
      }),
      shouldUseSupabase: () => true,
      redeemInSupabase: async () => ({
        code: code.code,
        tier: 5000 as const,
        quotaAmount: 5000,
        currentQuota: 5000,
        frozenQuota: 0
      })
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.currentQuota).toBe(5000);
    expect(getUserWallet("11111111-1111-4111-8111-111111111119").rechargeQuota).toBe(0);
  });

  it("rejects unauthenticated redemption requests", async () => {
    const response = await handleRedeemCodeRequest(new Request("http://localhost/api/quota/redeem-code", {
      method: "POST",
      body: JSON.stringify({
        code: "PDD-1000-ABCD1234"
      }),
      headers: {
        "content-type": "application/json"
      }
    }), {
      requireUser: async () => {
        throw new Error("AUTH_REQUIRED");
      }
    });
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.message).toContain("登录");
  });

  it("rejects non-uuid user id when supabase persistence mode is enabled", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

    const response = await handleRedeemCodeRequest(new Request("http://localhost/api/quota/redeem-code", {
      method: "POST",
      body: JSON.stringify({
        code: "PDD-1000-ABCD1234"
      }),
      headers: {
        "content-type": "application/json"
      }
    }), {
      requireUser: async () => ({
        id: "user-non-uuid",
        email: "user@example.com",
        role: "user"
      })
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.message).toContain("格式不正确");
  });

  it("filters activation code list by status and keyword", () => {
    const [codeA, codeB] = createActivationCodes({
      tier: 1000,
      count: 2
    });

    redeemActivationCode({
      code: codeA.code,
      userId: "user-3"
    });

    const unusedCodes = listActivationCodes({
      status: "unused"
    });
    const usedCodes = listActivationCodes({
      status: "used"
    });
    const keywordCodes = listActivationCodes({
      keyword: codeB.code.slice(-4)
    });

    expect(unusedCodes).toHaveLength(1);
    expect(unusedCodes[0]?.code).toBe(codeB.code);
    expect(usedCodes).toHaveLength(1);
    expect(usedCodes[0]?.code).toBe(codeA.code);
    expect(usedCodes[0]?.usedByEmail).toBeNull();
    expect(keywordCodes).toHaveLength(1);
    expect(keywordCodes[0]?.code).toBe(codeB.code);
  });

  it("rejects activation code batches larger than 50", () => {
    expect(() =>
      createActivationCodes({
        tier: 1000,
        count: 51
      })
    ).toThrow("最多一次生成 50 个");
  });

  it("rejects unsupported activation code tiers", () => {
    expect(() =>
      createActivationCodes({
        tier: 3000 as 1000,
        count: 1
      })
    ).toThrow("不支持这个激活码档位");
  });
});

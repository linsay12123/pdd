import { beforeEach, describe, expect, it } from "vitest";
import { redeemActivationCode } from "../../src/lib/activation-codes/redeem-activation-code";
import {
  createActivationCodes,
  resetActivationCodeState
} from "../../src/lib/activation-codes/repository";
import { getUserWallet, resetPaymentState } from "../../src/lib/payments/repository";

describe("activation code concurrency", () => {
  beforeEach(() => {
    resetActivationCodeState();
    resetPaymentState();
  });

  it("allows only one successful redemption for the same code", async () => {
    const [record] = createActivationCodes({
      tier: 5000,
      count: 1
    });

    const attempts = await Promise.allSettled([
      Promise.resolve().then(() =>
        redeemActivationCode({
          userId: "user-a",
          code: record.code
        })
      ),
      Promise.resolve().then(() =>
        redeemActivationCode({
          userId: "user-b",
          code: record.code
        })
      )
    ]);

    const successCount = attempts.filter((item) => item.status === "fulfilled").length;
    const rejected = attempts.find((item) => item.status === "rejected");

    expect(successCount).toBe(1);
    expect(rejected?.status).toBe("rejected");
    if (rejected?.status === "rejected") {
      expect(String(rejected.reason)).toContain("已经被使用");
    }

    const walletA = getUserWallet("user-a");
    const walletB = getUserWallet("user-b");
    expect(walletA.rechargeQuota + walletB.rechargeQuota).toBe(5000);
  });
});

import { describe, expect, it } from "vitest";
import { quoteGenerationTaskCost, quoteHumanizeTaskCost } from "../../src/lib/billing/quote-task-cost";
import { freezeQuota } from "../../src/lib/billing/freeze-quota";
import { releaseQuota } from "../../src/lib/billing/release-quota";
import { settleQuota } from "../../src/lib/billing/settle-quota";

describe("billing rules", () => {
  it("freezes quota when the wallet has enough balance", () => {
    const result = freezeQuota({
      wallet: {
        rechargeQuota: 12,
        subscriptionQuota: 10,
        frozenQuota: 0
      },
      amount: 8,
      taskId: "task-1",
      chargePath: "generation"
    });

    expect(result.wallet).toEqual({
      rechargeQuota: 12,
      subscriptionQuota: 2,
      frozenQuota: 8
    });
    expect(result.reservation).toMatchObject({
      fromSubscription: 8,
      fromRecharge: 0
    });
    expect(result.entry.kind).toBe("task_freeze");
  });

  it("releases frozen quota back to the original buckets after a failure", () => {
    const frozen = freezeQuota({
      wallet: {
        rechargeQuota: 5,
        subscriptionQuota: 6,
        frozenQuota: 0
      },
      amount: 9,
      taskId: "task-2",
      chargePath: "generation"
    });

    const released = releaseQuota({
      wallet: frozen.wallet,
      reservation: frozen.reservation
    });

    expect(released.wallet).toEqual({
      rechargeQuota: 5,
      subscriptionQuota: 6,
      frozenQuota: 0
    });
    expect(released.entry.kind).toBe("task_release");
  });

  it("settles frozen quota on success without refunding the balance", () => {
    const frozen = freezeQuota({
      wallet: {
        rechargeQuota: 8,
        subscriptionQuota: 4,
        frozenQuota: 0
      },
      amount: 6,
      taskId: "task-3",
      chargePath: "humanize"
    });

    const settled = settleQuota({
      wallet: frozen.wallet,
      reservation: frozen.reservation
    });

    expect(settled.wallet).toEqual({
      rechargeQuota: 6,
      subscriptionQuota: 0,
      frozenQuota: 0
    });
    expect(settled.entry.kind).toBe("humanize_settle");
  });

  it("uses fixed 500-point pricing for both article generation and auto de-ai", () => {
    expect(quoteGenerationTaskCost(2000)).toBe(500);
    expect(quoteGenerationTaskCost(5000)).toBe(500);
    expect(quoteHumanizeTaskCost(2000)).toBe(500);
    expect(quoteHumanizeTaskCost(5000)).toBe(500);
  });

  it("spends monthly subscription quota before recharge quota", () => {
    const result = freezeQuota({
      wallet: {
        rechargeQuota: 9,
        subscriptionQuota: 4,
        frozenQuota: 0
      },
      amount: 7,
      taskId: "task-4",
      chargePath: "generation"
    });

    expect(result.wallet).toEqual({
      rechargeQuota: 6,
      subscriptionQuota: 0,
      frozenQuota: 7
    });
    expect(result.reservation).toMatchObject({
      fromSubscription: 4,
      fromRecharge: 3
    });
  });
});

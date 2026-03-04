import { describe, expect, it } from "vitest";
import { chargeQuota } from "../../src/lib/billing/charge-quota";
import { quoteGenerationTaskCost, quoteHumanizeTaskCost } from "../../src/lib/billing/quote-task-cost";
import { freezeQuota } from "../../src/lib/billing/freeze-quota";
import { refundChargedQuota } from "../../src/lib/billing/refund-charged-quota";
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

  it("calculates generation cost as ceil(targetWordCount / 1000) * 230", () => {
    expect(quoteGenerationTaskCost(500)).toBe(230);
    expect(quoteGenerationTaskCost(1000)).toBe(230);
    expect(quoteGenerationTaskCost(1001)).toBe(460);
    expect(quoteGenerationTaskCost(2000)).toBe(460);
    expect(quoteGenerationTaskCost(5000)).toBe(1150);
  });

  it("calculates humanize cost as ceil(bodyWordCount / 1000) * 250", () => {
    expect(quoteHumanizeTaskCost(500)).toBe(250);
    expect(quoteHumanizeTaskCost(1000)).toBe(250);
    expect(quoteHumanizeTaskCost(1001)).toBe(500);
    expect(quoteHumanizeTaskCost(3000)).toBe(750);
    expect(quoteHumanizeTaskCost(5000)).toBe(1250);
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

  it("charges generation quota immediately when writing starts", () => {
    const result = chargeQuota({
      wallet: {
        rechargeQuota: 9,
        subscriptionQuota: 4,
        frozenQuota: 0
      },
      amount: 7,
      taskId: "task-charge-1",
      chargePath: "generation"
    });

    expect(result.wallet).toEqual({
      rechargeQuota: 6,
      subscriptionQuota: 0,
      frozenQuota: 0
    });
    expect(result.reservation).toMatchObject({
      fromSubscription: 4,
      fromRecharge: 3
    });
    expect(result.entry.kind).toBe("task_settle");
  });

  it("refunds charged generation quota back to the original buckets", () => {
    const charged = chargeQuota({
      wallet: {
        rechargeQuota: 5,
        subscriptionQuota: 6,
        frozenQuota: 0
      },
      amount: 9,
      taskId: "task-charge-2",
      chargePath: "generation"
    });

    const refunded = refundChargedQuota({
      wallet: charged.wallet,
      reservation: charged.reservation
    });

    expect(refunded.wallet).toEqual({
      rechargeQuota: 5,
      subscriptionQuota: 6,
      frozenQuota: 0
    });
    expect(refunded.entry.kind).toBe("task_release");
  });
});

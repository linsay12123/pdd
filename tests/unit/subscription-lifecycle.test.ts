import { describe, expect, it } from "vitest";
import {
  getSubscriptionByStripeId,
  resetSubscriptionStore,
  syncStripeSubscription
} from "../../src/lib/subscriptions/sync-stripe-subscription";
import {
  getGrantedSubscriptionMonths,
  grantMonthlyQuota,
  resetGrantedSubscriptionMonths
} from "../../src/lib/subscriptions/grant-monthly-quota";
import { getUserWallet, resetPaymentState, seedUserWallet } from "../../src/lib/payments/repository";

describe("subscription lifecycle", () => {
  it("syncs the latest Stripe subscription status into the local record", () => {
    resetSubscriptionStore();
    resetGrantedSubscriptionMonths();

    syncStripeSubscription({
      userId: "user-sub-1",
      stripeSubscriptionId: "sub_1",
      planId: "sub-monthly-starter",
      status: "active",
      currentPeriodEnd: "2026-03-31T23:59:59.000Z"
    });
    const updated = syncStripeSubscription({
      userId: "user-sub-1",
      stripeSubscriptionId: "sub_1",
      planId: "sub-monthly-starter",
      status: "canceled",
      currentPeriodEnd: "2026-04-30T23:59:59.000Z"
    });

    expect(updated.status).toBe("canceled");
    expect(getSubscriptionByStripeId("sub_1")?.currentPeriodEnd).toBe(
      "2026-04-30T23:59:59.000Z"
    );
  });

  it("grants monthly quota only to active subscriptions", () => {
    resetSubscriptionStore();
    resetGrantedSubscriptionMonths();
    resetPaymentState();
    seedUserWallet("user-sub-2", {
      rechargeQuota: 5,
      subscriptionQuota: 0,
      frozenQuota: 0
    });
    seedUserWallet("user-sub-3", {
      rechargeQuota: 4,
      subscriptionQuota: 0,
      frozenQuota: 0
    });

    syncStripeSubscription({
      userId: "user-sub-2",
      stripeSubscriptionId: "sub_2",
      planId: "sub-monthly-starter",
      status: "active",
      currentPeriodEnd: "2026-03-31T23:59:59.000Z"
    });
    syncStripeSubscription({
      userId: "user-sub-3",
      stripeSubscriptionId: "sub_3",
      planId: "sub-monthly-pro",
      status: "past_due",
      currentPeriodEnd: "2026-03-31T23:59:59.000Z"
    });

    const result = grantMonthlyQuota({
      asOf: "2026-03-02T10:00:00.000Z"
    });

    expect(result.grantedSubscriptions).toEqual(["sub_2"]);
    expect(getUserWallet("user-sub-2")).toEqual({
      rechargeQuota: 5,
      subscriptionQuota: 80,
      frozenQuota: 0
    });
    expect(getUserWallet("user-sub-3")).toEqual({
      rechargeQuota: 4,
      subscriptionQuota: 0,
      frozenQuota: 0
    });
  });

  it("does not grant the same subscription twice in the same month", () => {
    resetSubscriptionStore();
    resetGrantedSubscriptionMonths();
    resetPaymentState();
    seedUserWallet("user-sub-4", {
      rechargeQuota: 0,
      subscriptionQuota: 0,
      frozenQuota: 0
    });

    syncStripeSubscription({
      userId: "user-sub-4",
      stripeSubscriptionId: "sub_4",
      planId: "sub-monthly-pro",
      status: "active",
      currentPeriodEnd: "2026-03-31T23:59:59.000Z"
    });

    const first = grantMonthlyQuota({
      asOf: "2026-03-02T10:00:00.000Z"
    });
    const second = grantMonthlyQuota({
      asOf: "2026-03-18T10:00:00.000Z"
    });

    expect(first.grantedSubscriptions).toEqual(["sub_4"]);
    expect(second.grantedSubscriptions).toEqual([]);
    expect(getUserWallet("user-sub-4")).toEqual({
      rechargeQuota: 0,
      subscriptionQuota: 200,
      frozenQuota: 0
    });
    expect(getGrantedSubscriptionMonths()).toContain("subscription:sub_4:2026-03");
  });

  it("clears only leftover subscription quota when a new month starts", () => {
    resetSubscriptionStore();
    resetGrantedSubscriptionMonths();
    resetPaymentState();
    seedUserWallet("user-sub-5", {
      rechargeQuota: 9,
      subscriptionQuota: 17,
      frozenQuota: 0
    });

    syncStripeSubscription({
      userId: "user-sub-5",
      stripeSubscriptionId: "sub_5",
      planId: "sub-monthly-starter",
      status: "active",
      currentPeriodEnd: "2026-04-30T23:59:59.000Z"
    });

    const result = grantMonthlyQuota({
      asOf: "2026-04-02T10:00:00.000Z"
    });

    expect(result.grantedSubscriptions).toEqual(["sub_5"]);
    expect(getUserWallet("user-sub-5")).toEqual({
      rechargeQuota: 9,
      subscriptionQuota: 80,
      frozenQuota: 0
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  completePaidOrder,
  createPaymentOrder,
  getPaymentLedgerEntries,
  getUserWallet,
  resetPaymentState,
  seedUserWallet
} from "../../src/lib/payments/repository";
import {
  buildStripeSignatureHeader,
  parseStripeWebhookEvent
} from "../../src/lib/payments/stripe-signature";

describe("payment webhooks", () => {
  it("verifies the Stripe signature before using the event payload", () => {
    const payload = JSON.stringify({
      id: "evt_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_1",
          metadata: {
            order_id: "order-1"
          },
          payment_status: "paid"
        }
      }
    });
    const secret = "whsec_test_secret";
    const signature = buildStripeSignatureHeader({
      payload,
      secret,
      timestamp: 1_772_417_904
    });

    const event = parseStripeWebhookEvent({
      payload,
      signatureHeader: signature,
      secret
    });

    expect(event.type).toBe("checkout.session.completed");
    expect(event.data.object.metadata?.order_id).toBe("order-1");
  });

  it("marks the order paid and credits recharge quota only once", () => {
    resetPaymentState();
    seedUserWallet("user-1", {
      rechargeQuota: 3,
      subscriptionQuota: 0,
      frozenQuota: 0
    });
    createPaymentOrder({
      id: "order-1",
      userId: "user-1",
      provider: "stripe",
      amountUsd: 19,
      quotaAmount: 20,
      kind: "recharge"
    });

    const first = completePaidOrder({
      orderId: "order-1",
      providerPaymentId: "cs_test_1"
    });
    const second = completePaidOrder({
      orderId: "order-1",
      providerPaymentId: "cs_test_1"
    });

    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false);
    expect(getUserWallet("user-1")).toEqual({
      rechargeQuota: 23,
      subscriptionQuota: 0,
      frozenQuota: 0
    });
    expect(getPaymentLedgerEntries("user-1")).toEqual([
      expect.objectContaining({
        kind: "recharge_credit",
        amount: 20
      })
    ]);
  });
});

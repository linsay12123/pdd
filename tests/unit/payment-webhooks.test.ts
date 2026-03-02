import { describe, expect, it } from "vitest";
import {
  buildCoinbaseChargePayload,
  completeCoinbaseChargeFromEvent
} from "../../src/lib/payments/coinbase-charge";
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

  it("builds the crypto charge as USDT and USDC with multiple chain choices", () => {
    const payload = buildCoinbaseChargePayload({
      orderId: "order-2",
      packageName: "进阶包",
      amountUsd: 49,
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel"
    });

    expect(payload.pricing_type).toBe("fixed_price");
    expect(payload.local_price).toEqual({
      amount: "49.00",
      currency: "USD"
    });
    expect(payload.metadata.accepted_assets).toEqual(["USDC", "USDT"]);
    expect(payload.metadata.accepted_networks).toEqual([
      "base",
      "ethereum",
      "solana"
    ]);
  });

  it("settles the crypto order when the coinbase event is confirmed", () => {
    resetPaymentState();
    seedUserWallet("user-2", {
      rechargeQuota: 0,
      subscriptionQuota: 0,
      frozenQuota: 0
    });
    createPaymentOrder({
      id: "order-2",
      userId: "user-2",
      provider: "coinbase",
      amountUsd: 49,
      quotaAmount: 60,
      kind: "recharge"
    });

    const result = completeCoinbaseChargeFromEvent({
      event: {
        type: "charge:confirmed",
        data: {
          id: "charge_123",
          metadata: {
            order_id: "order-2"
          }
        }
      }
    });

    expect(result.applied).toBe(true);
    expect(getUserWallet("user-2")).toEqual({
      rechargeQuota: 60,
      subscriptionQuota: 0,
      frozenQuota: 0
    });
  });
});

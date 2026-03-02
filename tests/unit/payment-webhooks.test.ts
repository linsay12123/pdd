import { describe, expect, it } from "vitest";
import {
  buildAlipayNotifyPayload,
  completeAlipayPaymentFromNotify
} from "../../src/lib/payments/alipay-order";
import {
  completePaidOrder,
  confirmPaymentOrderProvider,
  createPaymentOrder,
  getPaymentLedgerEntries,
  getUserWallet,
  resetPaymentState,
  seedUserWallet
} from "../../src/lib/payments/repository";
import {
  confirmManualCryptoPayment,
  createManualCryptoOrder
} from "../../src/lib/payments/manual-crypto";
import {
  buildWeChatNotifyPayload,
  completeWeChatPaymentFromNotify
} from "../../src/lib/payments/wechat-order";
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

  it("builds a manual stablecoin order with USDC on the three supported chains", () => {
    const order = createManualCryptoOrder({
      userId: "user-2",
      packageId: "recharge-growth"
    });

    expect(order.amountUsd).toBe(49);
    expect(order.acceptedAssets).toEqual(["USDC"]);
    expect(order.acceptedNetworks).toEqual([
      "solana",
      "ethereum",
      "tron"
    ]);
    expect(order.addresses).toEqual([
      expect.objectContaining({
        asset: "USDC",
        network: "solana",
        address: "5dY6hPSYFvH3N3NAKqge5rbymVxBrqoLFAJZ25HBhZMn"
      }),
      expect.objectContaining({
        asset: "USDC",
        network: "ethereum",
        address: "0x746C5FD7084588f17e915CCebdDD8b4E8A7293C1"
      }),
      expect.objectContaining({
        asset: "USDC",
        network: "tron",
        address: "TCF5CTNcAxriK7yiohZn92zmExok2zqhaq"
      })
    ]);
  });

  it("settles the manual crypto order only after an operator confirms payment", () => {
    resetPaymentState();
    seedUserWallet("user-2", {
      rechargeQuota: 0,
      subscriptionQuota: 0,
      frozenQuota: 0
    });
    const order = createManualCryptoOrder({
      userId: "user-2",
      packageId: "recharge-growth"
    });
    expect(confirmPaymentOrderProvider(order.orderId)).toBe("crypto");

    const result = confirmManualCryptoPayment({
      orderId: order.orderId,
      transferReference: "0xabc123"
    });

    expect(result.applied).toBe(true);
    expect(getUserWallet("user-2")).toEqual({
      rechargeQuota: 60,
      subscriptionQuota: 0,
      frozenQuota: 0
    });
  });

  it("settles an alipay recharge after a valid notify payload arrives", () => {
    resetPaymentState();
    seedUserWallet("user-3", {
      rechargeQuota: 1,
      subscriptionQuota: 0,
      frozenQuota: 0
    });
    createPaymentOrder({
      id: "order-3",
      userId: "user-3",
      provider: "alipay",
      amountUsd: 19,
      quotaAmount: 20,
      kind: "recharge"
    });

    const payload = buildAlipayNotifyPayload({
      orderId: "order-3",
      tradeNo: "ali_trade_1",
      secret: "alipay-secret"
    });
    const result = completeAlipayPaymentFromNotify({
      payload,
      secret: "alipay-secret"
    });

    expect(result.applied).toBe(true);
    expect(getUserWallet("user-3")).toEqual({
      rechargeQuota: 21,
      subscriptionQuota: 0,
      frozenQuota: 0
    });
  });

  it("settles a wechat recharge after a valid notify payload arrives", () => {
    resetPaymentState();
    seedUserWallet("user-4", {
      rechargeQuota: 2,
      subscriptionQuota: 0,
      frozenQuota: 0
    });
    createPaymentOrder({
      id: "order-4",
      userId: "user-4",
      provider: "wechat",
      amountUsd: 19,
      quotaAmount: 20,
      kind: "recharge"
    });

    const payload = buildWeChatNotifyPayload({
      orderId: "order-4",
      transactionId: "wx_tx_1",
      secret: "wechat-secret"
    });
    const result = completeWeChatPaymentFromNotify({
      payload,
      secret: "wechat-secret"
    });

    expect(result.applied).toBe(true);
    expect(getUserWallet("user-4")).toEqual({
      rechargeQuota: 22,
      subscriptionQuota: 0,
      frozenQuota: 0
    });
  });
});

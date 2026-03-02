import { createLedgerEntry } from "@/src/lib/billing/ledger";
import { incrementMetric } from "@/src/lib/observability/metrics";
import { logPaymentEvent } from "@/src/lib/observability/logger";
import type {
  PaymentOrderKind,
  PaymentOrderRecord,
  PaymentProvider,
  WalletSnapshot
} from "@/src/types/billing";

const orderStore = new Map<string, PaymentOrderRecord>();
const walletStore = new Map<string, WalletSnapshot>();
const paymentLedgerStore = new Map<string, ReturnType<typeof createLedgerEntry>[]>();

export function resetPaymentState() {
  orderStore.clear();
  walletStore.clear();
  paymentLedgerStore.clear();
}

export function seedUserWallet(userId: string, wallet: WalletSnapshot) {
  return setUserWallet(userId, wallet);
}

export function setUserWallet(userId: string, wallet: WalletSnapshot) {
  walletStore.set(userId, wallet);
  return wallet;
}

export function getUserWallet(userId: string) {
  return (
    walletStore.get(userId) ?? {
      rechargeQuota: 0,
      subscriptionQuota: 0,
      frozenQuota: 0
    }
  );
}

export function createPaymentOrder(input: {
  id: string;
  userId: string;
  provider: PaymentProvider;
  amountUsd: number;
  quotaAmount: number;
  kind: PaymentOrderKind;
}) {
  const order: PaymentOrderRecord = {
    ...input,
    status: "pending"
  };

  orderStore.set(order.id, order);
  return order;
}

export function getPaymentOrder(orderId: string) {
  return orderStore.get(orderId) ?? null;
}

export function confirmPaymentOrderProvider(orderId: string) {
  return getPaymentOrder(orderId)?.provider ?? null;
}

export function completePaidOrder(input: {
  orderId: string;
  providerPaymentId: string;
}) {
  const order = orderStore.get(input.orderId);

  if (!order) {
    throw new Error("Payment order not found");
  }

  if (order.status === "paid") {
    return {
      applied: false,
      order
    };
  }

  const wallet = getUserWallet(order.userId);
  const nextWallet = {
    ...wallet,
    rechargeQuota:
      order.kind === "recharge"
        ? wallet.rechargeQuota + order.quotaAmount
        : wallet.rechargeQuota,
    subscriptionQuota:
      order.kind === "subscription"
        ? wallet.subscriptionQuota + order.quotaAmount
        : wallet.subscriptionQuota
  };
  const nextOrder: PaymentOrderRecord = {
    ...order,
    status: "paid",
    providerPaymentId: input.providerPaymentId
  };
  const ledgerEntry = createLedgerEntry({
    kind: order.kind === "recharge" ? "recharge_credit" : "subscription_credit",
    amount: order.quotaAmount,
    taskId: order.id,
    note: `Credited ${order.quotaAmount} quota from ${order.provider}`
  });

  walletStore.set(order.userId, nextWallet);
  orderStore.set(order.id, nextOrder);
  paymentLedgerStore.set(order.userId, [
    ...(paymentLedgerStore.get(order.userId) ?? []),
    ledgerEntry
  ]);
  logPaymentEvent({
    orderId: order.id,
    userId: order.userId,
    provider: order.provider,
    providerEventId: input.providerPaymentId,
    note: `Payment settled via ${order.provider}`
  });
  incrementMetric("payment_paid");

  return {
    applied: true,
    order: nextOrder
  };
}

export function getPaymentLedgerEntries(userId: string) {
  return paymentLedgerStore.get(userId) ?? [];
}

export function appendPaymentLedgerEntry(
  userId: string,
  entry: ReturnType<typeof createLedgerEntry>
) {
  paymentLedgerStore.set(userId, [
    ...(paymentLedgerStore.get(userId) ?? []),
    entry
  ]);

  return entry;
}

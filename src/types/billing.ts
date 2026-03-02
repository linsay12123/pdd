export type QuotaLedgerKind =
  | "recharge_credit"
  | "subscription_credit"
  | "task_freeze"
  | "task_settle"
  | "task_release"
  | "humanize_freeze"
  | "humanize_settle"
  | "humanize_release";

export type WalletSnapshot = {
  rechargeQuota: number;
  subscriptionQuota: number;
  frozenQuota: number;
};

export type TaskChargePath = "generation" | "humanize";

export type FrozenQuotaReservation = {
  taskId: string;
  chargePath: TaskChargePath;
  totalAmount: number;
  fromSubscription: number;
  fromRecharge: number;
};

export type QuotaLedgerEntry = {
  ledgerKey: string;
  kind: QuotaLedgerKind;
  amount: number;
  taskId: string;
  note: string;
};

export type PaymentProvider =
  | "stripe"
  | "coinbase"
  | "alipay"
  | "wechat";

export type PaymentOrderKind = "recharge" | "subscription";

export type PaymentOrderStatus = "pending" | "paid";

export type PaymentOrderRecord = {
  id: string;
  userId: string;
  provider: PaymentProvider;
  amountUsd: number;
  quotaAmount: number;
  kind: PaymentOrderKind;
  status: PaymentOrderStatus;
  providerPaymentId?: string;
};

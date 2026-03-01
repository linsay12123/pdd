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

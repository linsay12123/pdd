import type {
  QuotaLedgerEntry,
  QuotaLedgerKind,
  TaskChargePath,
  WalletSnapshot
} from "@/src/types/billing";

type LedgerAction = "freeze" | "settle" | "release";

export function createLedgerEntry({
  kind,
  amount,
  taskId,
  note
}: {
  kind: QuotaLedgerKind;
  amount: number;
  taskId: string;
  note: string;
}): QuotaLedgerEntry {
  return {
    ledgerKey: `${taskId}:${kind}:${amount}`,
    kind,
    amount,
    taskId,
    note
  };
}

export function resolveLedgerKind(
  chargePath: TaskChargePath,
  action: LedgerAction
): QuotaLedgerKind {
  if (chargePath === "humanize") {
    return `humanize_${action}` as QuotaLedgerKind;
  }

  return `task_${action}` as QuotaLedgerKind;
}

export function clearSubscriptionQuota(wallet: WalletSnapshot): WalletSnapshot {
  return {
    ...wallet,
    subscriptionQuota: 0
  };
}

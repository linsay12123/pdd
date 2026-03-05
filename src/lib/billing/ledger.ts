import { randomUUID } from "node:crypto";
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
  note,
  eventKey
}: {
  kind: QuotaLedgerKind;
  amount: number;
  taskId: string;
  note: string;
  eventKey?: string;
}): QuotaLedgerEntry {
  const suffix = eventKey?.trim() || randomUUID();

  return {
    ledgerKey: `${taskId}:${kind}:${suffix}`,
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

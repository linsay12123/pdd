import { randomUUID } from "node:crypto";
import type {
  FrozenQuotaReservation,
  TaskChargePath,
  WalletSnapshot
} from "@/src/types/billing";
import { createLedgerEntry, resolveLedgerKind } from "@/src/lib/billing/ledger";

type FreezeQuotaInput = {
  wallet: WalletSnapshot;
  amount: number;
  taskId: string;
  chargePath: TaskChargePath;
};

export function freezeQuota({
  wallet,
  amount,
  taskId,
  chargePath
}: FreezeQuotaInput) {
  if (amount <= 0) {
    throw new Error("Freeze amount must be greater than zero");
  }

  const totalAvailable = wallet.subscriptionQuota + wallet.rechargeQuota;

  if (totalAvailable < amount) {
    throw new Error("Not enough quota to freeze");
  }

  const fromSubscription = Math.min(wallet.subscriptionQuota, amount);
  const fromRecharge = amount - fromSubscription;
  const reservation: FrozenQuotaReservation = {
    reservationId: randomUUID(),
    taskId,
    chargePath,
    totalAmount: amount,
    fromSubscription,
    fromRecharge
  };

  return {
    wallet: {
      rechargeQuota: wallet.rechargeQuota - fromRecharge,
      subscriptionQuota: wallet.subscriptionQuota - fromSubscription,
      frozenQuota: wallet.frozenQuota + amount
    },
    reservation,
    entry: createLedgerEntry({
      kind: resolveLedgerKind(chargePath, "freeze"),
      amount,
      taskId,
      note: `Froze ${amount} quota for ${chargePath}`,
      eventKey: reservation.reservationId
    })
  };
}

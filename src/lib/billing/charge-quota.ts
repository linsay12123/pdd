import { randomUUID } from "node:crypto";
import type {
  FrozenQuotaReservation,
  TaskChargePath,
  WalletSnapshot
} from "@/src/types/billing";
import { createLedgerEntry, resolveLedgerKind } from "@/src/lib/billing/ledger";

type ChargeQuotaInput = {
  wallet: WalletSnapshot;
  amount: number;
  taskId: string;
  chargePath: TaskChargePath;
};

export function chargeQuota({
  wallet,
  amount,
  taskId,
  chargePath
}: ChargeQuotaInput) {
  if (amount <= 0) {
    throw new Error("Charge amount must be greater than zero");
  }

  const totalAvailable = wallet.subscriptionQuota + wallet.rechargeQuota;

  if (totalAvailable < amount) {
    throw new Error("Not enough quota to charge");
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
      frozenQuota: wallet.frozenQuota
    },
    reservation,
    entry: createLedgerEntry({
      kind: resolveLedgerKind(chargePath, "settle"),
      amount,
      taskId,
      note: `Charged ${amount} quota for ${chargePath}`,
      eventKey: reservation.reservationId
    })
  };
}

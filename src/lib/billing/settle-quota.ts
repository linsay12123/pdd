import type { FrozenQuotaReservation, WalletSnapshot } from "@/src/types/billing";
import { createLedgerEntry, resolveLedgerKind } from "@/src/lib/billing/ledger";

type SettleQuotaInput = {
  wallet: WalletSnapshot;
  reservation: FrozenQuotaReservation;
};

export function settleQuota({ wallet, reservation }: SettleQuotaInput) {
  if (wallet.frozenQuota < reservation.totalAmount) {
    throw new Error("Frozen quota is lower than the settlement amount");
  }

  return {
    wallet: {
      ...wallet,
      frozenQuota: wallet.frozenQuota - reservation.totalAmount
    },
    entry: createLedgerEntry({
      kind: resolveLedgerKind(reservation.chargePath, "settle"),
      amount: reservation.totalAmount,
      taskId: reservation.taskId,
      note: `Settled ${reservation.totalAmount} quota for ${reservation.chargePath}`
    })
  };
}

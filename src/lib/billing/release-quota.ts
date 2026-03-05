import type { FrozenQuotaReservation, WalletSnapshot } from "@/src/types/billing";
import { createLedgerEntry, resolveLedgerKind } from "@/src/lib/billing/ledger";

type ReleaseQuotaInput = {
  wallet: WalletSnapshot;
  reservation: FrozenQuotaReservation;
};

export function releaseQuota({ wallet, reservation }: ReleaseQuotaInput) {
  if (wallet.frozenQuota < reservation.totalAmount) {
    throw new Error("Frozen quota is lower than the release amount");
  }

  return {
    wallet: {
      rechargeQuota: wallet.rechargeQuota + reservation.fromRecharge,
      subscriptionQuota: wallet.subscriptionQuota + reservation.fromSubscription,
      frozenQuota: wallet.frozenQuota - reservation.totalAmount
    },
    entry: createLedgerEntry({
      kind: resolveLedgerKind(reservation.chargePath, "release"),
      amount: reservation.totalAmount,
      taskId: reservation.taskId,
      note: `Released ${reservation.totalAmount} quota for ${reservation.chargePath}`,
      eventKey: reservation.reservationId
    })
  };
}

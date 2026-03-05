import type { FrozenQuotaReservation, WalletSnapshot } from "@/src/types/billing";
import { createLedgerEntry, resolveLedgerKind } from "@/src/lib/billing/ledger";

type RefundChargedQuotaInput = {
  wallet: WalletSnapshot;
  reservation: FrozenQuotaReservation;
};

export function refundChargedQuota({
  wallet,
  reservation
}: RefundChargedQuotaInput) {
  return {
    wallet: {
      rechargeQuota: wallet.rechargeQuota + reservation.fromRecharge,
      subscriptionQuota: wallet.subscriptionQuota + reservation.fromSubscription,
      frozenQuota: wallet.frozenQuota
    },
    entry: createLedgerEntry({
      kind: resolveLedgerKind(reservation.chargePath, "release"),
      amount: reservation.totalAmount,
      taskId: reservation.taskId,
      note: `Refunded ${reservation.totalAmount} quota for ${reservation.chargePath}`,
      eventKey: reservation.reservationId
    })
  };
}

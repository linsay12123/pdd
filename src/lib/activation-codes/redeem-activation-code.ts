import { createLedgerEntry } from "@/src/lib/billing/ledger";
import {
  appendPaymentLedgerEntry,
  getUserWallet,
  setUserWallet
} from "@/src/lib/payments/repository";
import { redeemStoredActivationCode } from "@/src/lib/activation-codes/repository";

export function redeemActivationCode(input: {
  code: string;
  userId: string;
}) {
  const redemption = redeemStoredActivationCode(input);
  const wallet = getUserWallet(input.userId);
  const nextWallet = {
    ...wallet,
    rechargeQuota: wallet.rechargeQuota + redemption.quotaAmount
  };
  const entry = createLedgerEntry({
    kind: "activation_credit",
    amount: redemption.quotaAmount,
    taskId: redemption.code,
    note: `Redeemed activation code ${redemption.code}`
  });

  setUserWallet(input.userId, nextWallet);
  appendPaymentLedgerEntry(input.userId, entry);

  return {
    redemption,
    wallet: nextWallet,
    entry
  };
}

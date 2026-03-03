import { requireCurrentSessionUser } from "@/src/lib/auth/current-user";
import { getPaymentLedgerHistory, getUserLedgerHistoryFromSupabase } from "@/src/lib/payments/ledger-history";
import {
  isUuidLike,
  shouldUseSupabasePersistence
} from "@/src/lib/persistence/runtime-mode";

export async function getCurrentSessionLedger(limit = 8) {
  const user = await requireCurrentSessionUser();
  const useSupabase = shouldUseSupabasePersistence();

  if (useSupabase && isUuidLike(user.id)) {
    return getUserLedgerHistoryFromSupabase(user.id, limit);
  }

  return getPaymentLedgerHistory(user.id, limit);
}

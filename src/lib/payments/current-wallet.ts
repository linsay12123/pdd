import { requireCurrentSessionUser } from "@/src/lib/auth/current-user";
import { getUserWallet } from "@/src/lib/payments/repository";
import { getUserWalletFromSupabase } from "@/src/lib/payments/supabase-wallet";
import {
  isUuidLike,
  shouldUseSupabasePersistence
} from "@/src/lib/persistence/runtime-mode";

export async function getCurrentSessionWallet() {
  const user = await requireCurrentSessionUser();
  const useSupabase = shouldUseSupabasePersistence();
  const wallet =
    useSupabase && isUuidLike(user.id)
      ? await getUserWalletFromSupabase(user.id)
      : getUserWallet(user.id);

  return {
    user,
    wallet
  };
}

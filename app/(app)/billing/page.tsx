import { BillingPageClient } from "@/src/components/pages/billing-page-client";
import { getCurrentSessionLedger } from "@/src/lib/payments/current-ledger";
import { getCurrentSessionWallet } from "@/src/lib/payments/current-wallet";

export default async function BillingPage() {
  const { wallet } = await getCurrentSessionWallet();
  const ledger = await getCurrentSessionLedger();

  return (
    <BillingPageClient
      initialQuota={wallet.rechargeQuota}
      initialLedger={ledger}
    />
  );
}

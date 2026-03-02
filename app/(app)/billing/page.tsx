import { BillingPageClient } from "@/src/components/pages/billing-page-client";
import { getCurrentSessionWallet } from "@/src/lib/payments/current-wallet";

export default async function BillingPage() {
  const { wallet } = await getCurrentSessionWallet();

  return <BillingPageClient initialQuota={wallet.rechargeQuota} />;
}

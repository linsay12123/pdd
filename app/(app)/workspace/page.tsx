import { WorkspacePageClient } from "@/src/components/pages/workspace-page-client";
import { getCurrentSessionWallet } from "@/src/lib/payments/current-wallet";

export default async function WorkspacePage() {
  const { wallet } = await getCurrentSessionWallet();

  return <WorkspacePageClient initialQuota={wallet.rechargeQuota} />;
}

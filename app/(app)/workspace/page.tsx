import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WorkspacePageClient } from "@/src/components/pages/workspace-page-client";
import { getCurrentSessionUserResolution } from "@/src/lib/auth/current-user";
import { decideWorkspaceEntry } from "@/src/lib/auth/workspace-entry";
import { getCurrentSessionWallet } from "@/src/lib/payments/current-wallet";

export default async function WorkspacePage() {
  const cookieStore = await cookies();
  const hasSessionCookie = cookieStore
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token"));
  const sessionResolution = await getCurrentSessionUserResolution();
  const entryDecision = decideWorkspaceEntry({
    hasSessionCookie,
    sessionResolution
  });

  if (entryDecision.kind === "redirect") {
    redirect(entryDecision.to);
  }

  const { wallet } = await getCurrentSessionWallet();

  return <WorkspacePageClient initialQuota={wallet.rechargeQuota} />;
}

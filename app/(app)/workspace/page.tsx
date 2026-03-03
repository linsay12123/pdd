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

  let wallet;

  try {
    const walletResult = await getCurrentSessionWallet();
    wallet = walletResult.wallet;
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      redirect(
        hasSessionCookie
          ? "/auth/complete?next=%2Fworkspace"
          : "/login?redirect=%2Fworkspace"
      );
    }

    if (error instanceof Error && error.message === "ACCOUNT_FROZEN") {
      redirect(
        `/login?message=${encodeURIComponent("当前账号已被冻结，请联系客服支持团队处理。")}`
      );
    }

    throw error;
  }

  return <WorkspacePageClient initialQuota={wallet.rechargeQuota} />;
}

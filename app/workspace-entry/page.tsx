import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { normalizeRedirectTarget } from "@/src/lib/auth/auth-form";
import { getCurrentSessionUserResolution } from "@/src/lib/auth/current-user";
import { decideWorkspaceEntry } from "@/src/lib/auth/workspace-entry";

type WorkspaceEntryPageProps = {
  searchParams?: Promise<{
    next?: string;
  }>;
};

export default async function WorkspaceEntryPage({ searchParams }: WorkspaceEntryPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const nextPath = normalizeRedirectTarget(resolvedSearchParams.next);
  const cookieStore = await cookies();
  const hasSessionCookie = cookieStore
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token"));
  const sessionResolution = await getCurrentSessionUserResolution();
  const entryDecision = decideWorkspaceEntry({
    hasSessionCookie,
    sessionResolution,
    targetPath: nextPath
  });

  if (entryDecision.kind === "allow") {
    redirect(nextPath);
  }

  redirect(entryDecision.to);
}

import { buildAuthCompletePath, normalizeRedirectTarget } from "@/src/lib/auth/auth-form";
import type { SessionUserResolution } from "@/src/lib/auth/current-user";

type WorkspaceEntryDecision =
  | {
      kind: "allow";
    }
  | {
      kind: "redirect";
      to: string;
    };

const frozenAccountMessage = "当前账号已被冻结，请联系客服支持团队处理。";

export function decideWorkspaceEntry(input: {
  hasSessionCookie: boolean;
  sessionResolution: SessionUserResolution;
  targetPath?: string;
}): WorkspaceEntryDecision {
  const targetPath = normalizeRedirectTarget(input.targetPath ?? "/workspace");

  if (input.sessionResolution.status === "ready") {
    return {
      kind: "allow"
    };
  }

  if (input.sessionResolution.status === "frozen") {
    return {
      kind: "redirect",
      to: `/login?message=${encodeURIComponent(frozenAccountMessage)}`
    };
  }

  if (input.sessionResolution.status === "profile_missing") {
    return {
      kind: "redirect",
      to: buildAuthCompletePath(targetPath)
    };
  }

  return {
    kind: "redirect",
    to: `/login?redirect=${encodeURIComponent(targetPath)}`
  };
}

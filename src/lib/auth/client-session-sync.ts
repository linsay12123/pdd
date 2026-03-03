"use client";

import type { Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/src/lib/supabase/client";

export async function syncSessionToServer(input?: {
  accessToken?: string | null;
  refreshToken?: string | null;
}) {
  const accessToken = input?.accessToken?.trim() ?? "";
  const refreshToken = input?.refreshToken?.trim() ?? "";

  if (!accessToken || !refreshToken) {
    return false;
  }

  const response = await fetch("/api/auth/sync-session", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      accessToken,
      refreshToken
    })
  });

  return response.ok;
}

export async function syncCurrentBrowserSessionToServer() {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();

  return syncSessionToServer({
    accessToken: data.session?.access_token,
    refreshToken: data.session?.refresh_token
  });
}

export function getSessionTokens(session?: Session | null) {
  return {
    accessToken: session?.access_token ?? "",
    refreshToken: session?.refresh_token ?? ""
  };
}

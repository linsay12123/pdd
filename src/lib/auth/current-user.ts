import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import type { SessionUser } from "@/src/types/auth";

type SupabaseLike = {
  auth: {
    getUser: () => Promise<{
      data: {
        user: {
          id: string;
          email?: string | null;
        } | null;
      };
      error: unknown;
    }>;
  };
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{
          data: {
            id: string;
            email: string;
            role: "user" | "admin";
            is_frozen?: boolean;
          } | null;
          error: unknown;
        }>;
      };
    };
  };
};

type GetCurrentSessionUserOptions = {
  supabase?: SupabaseLike;
};

type SessionUserProfile = SessionUser & {
  isFrozen: boolean;
};

export async function getCurrentSessionUser(
  options: GetCurrentSessionUserOptions = {}
): Promise<SessionUser | null> {
  const profile = await getCurrentSessionUserProfile(options);

  if (!profile || profile.isFrozen) {
    return null;
  }

  return {
    id: profile.id,
    email: profile.email,
    role: profile.role
  };
}

export async function requireCurrentSessionUser(
  options: GetCurrentSessionUserOptions = {}
): Promise<SessionUser> {
  const profile = await getCurrentSessionUserProfile(options);

  if (!profile) {
    throw new Error("AUTH_REQUIRED");
  }

  if (profile.isFrozen) {
    throw new Error("ACCOUNT_FROZEN");
  }

  return {
    id: profile.id,
    email: profile.email,
    role: profile.role
  };
}

async function getCurrentSessionUserProfile(
  options: GetCurrentSessionUserOptions
): Promise<SessionUserProfile | null> {
  const supabase = options.supabase ?? (await createSupabaseServerClient());
  const authResult = await supabase.auth.getUser();
  const authUser = authResult.data.user;

  if (!authUser) {
    return null;
  }

  const profileResult = await supabase
    .from("profiles")
    .select("id,email,role,is_frozen")
    .eq("id", authUser.id)
    .maybeSingle();

  const profile = profileResult.data;

  if (!profile) {
    return null;
  }

  return {
    id: profile.id,
    email: profile.email || authUser.email || "",
    role: profile.role,
    isFrozen: Boolean(profile.is_frozen)
  };
}

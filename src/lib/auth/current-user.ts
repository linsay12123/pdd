import { createSupabaseReadonlyServerClient } from "@/src/lib/supabase/server-readonly";
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

export type SessionUserResolution =
  | {
      status: "anonymous";
    }
  | {
      status: "profile_missing";
      authUserId: string;
      email: string;
    }
  | {
      status: "frozen";
      user: SessionUser;
    }
  | {
      status: "ready";
      user: SessionUser;
    };

export async function getCurrentSessionUser(
  options: GetCurrentSessionUserOptions = {}
): Promise<SessionUser | null> {
  const resolution = await getCurrentSessionUserResolution(options);

  if (resolution.status !== "ready") {
    return null;
  }

  return resolution.user;
}

export async function requireCurrentSessionUser(
  options: GetCurrentSessionUserOptions = {}
): Promise<SessionUser> {
  const resolution = await getCurrentSessionUserResolution(options);

  if (resolution.status === "anonymous" || resolution.status === "profile_missing") {
    throw new Error("AUTH_REQUIRED");
  }

  if (resolution.status === "frozen") {
    throw new Error("ACCOUNT_FROZEN");
  }

  return resolution.user;
}

export async function getCurrentSessionUserResolution(
  options: GetCurrentSessionUserOptions = {}
): Promise<SessionUserResolution> {
  const profile = await getCurrentSessionUserProfile(options);

  if (!profile) {
    const supabase = options.supabase ?? (await createSupabaseReadonlyServerClient());
    const authResult = await supabase.auth.getUser();
    const authUser = authResult.data.user;

    if (!authUser) {
      return {
        status: "anonymous"
      };
    }

    return {
      status: "profile_missing",
      authUserId: authUser.id,
      email: authUser.email ?? ""
    };
  }

  const normalizedUser = {
    id: profile.id,
    email: profile.email,
    role: profile.role
  } satisfies SessionUser;

  if (profile.isFrozen) {
    return {
      status: "frozen",
      user: normalizedUser
    };
  }

  return {
    status: "ready",
    user: normalizedUser
  };
}

async function getCurrentSessionUserProfile(
  options: GetCurrentSessionUserOptions
): Promise<SessionUserProfile | null> {
  const supabase = options.supabase ?? (await createSupabaseReadonlyServerClient());
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

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/src/config/env";

export async function createSupabaseReadonlyServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        // Server pages can read auth cookies but must never mutate them.
        setAll() {}
      }
    }
  );
}

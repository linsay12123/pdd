import { afterEach, describe, expect, it } from "vitest";
import { shouldUseSupabasePersistence } from "../../src/lib/persistence/runtime-mode";

const originalEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
};

describe("runtime persistence mode", () => {
  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv.NEXT_PUBLIC_SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnv.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("uses memory mode when required supabase env vars are missing", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";

    expect(shouldUseSupabasePersistence()).toBe(false);
  });

  it("uses supabase mode when required env vars exist", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

    expect(shouldUseSupabasePersistence()).toBe(true);
  });
});

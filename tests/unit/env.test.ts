import { describe, expect, it } from "vitest";
import { env } from "../../src/config/env";

describe("env", () => {
  it("exposes the required platform keys as strings", () => {
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBeTypeOf("string");
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeTypeOf("string");
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeTypeOf("string");
    expect(env.OPENAI_API_KEY).toBeTypeOf("string");
    expect(env.UNDETECTABLE_API_KEY).toBeTypeOf("string");
    expect(env.TRIGGER_SECRET_KEY).toBeTypeOf("string");
  });
});

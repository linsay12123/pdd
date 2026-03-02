import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("profile bootstrap migration", () => {
  it("creates profile and wallet rows for each new auth user", () => {
    const migrationPath = path.resolve(
      __dirname,
      "../../supabase/migrations/202603030005_profile_bootstrap.sql"
    );
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("create or replace function public.handle_new_auth_user()");
    expect(sql).toContain("insert into public.profiles");
    expect(sql).toContain("insert into public.quota_wallets");
    expect(sql).toContain("create trigger on_auth_user_created");
    expect(sql).toContain("after insert on auth.users");
  });
});

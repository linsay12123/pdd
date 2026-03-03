import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const initialSchema = readFileSync(
  "/Users/jeffo/Desktop/自动写作/.worktrees/bootstrap-shell/supabase/migrations/202603020001_initial_schema.sql",
  "utf8"
);

const recursiveFixMigration = readFileSync(
  "/Users/jeffo/Desktop/自动写作/.worktrees/bootstrap-shell/supabase/migrations/202603030007_fix_recursive_admin_policies.sql",
  "utf8"
);

describe("rls policies", () => {
  it("uses a dedicated admin helper instead of self-reading profiles inside policies", () => {
    expect(initialSchema).toContain("create or replace function public.is_current_user_admin()");
    expect(initialSchema).not.toContain("from public.profiles as admin_profile");
    expect(initialSchema).toContain("using (public.is_current_user_admin())");
    expect(initialSchema).toContain("with check (public.is_current_user_admin())");
  });

  it("ships a migration that repairs the recursive admin policies in production", () => {
    expect(recursiveFixMigration).toContain("drop policy if exists \"profiles admin all\"");
    expect(recursiveFixMigration).toContain("create or replace function public.is_current_user_admin()");
    expect(recursiveFixMigration).toContain("using (public.is_current_user_admin())");
  });
});

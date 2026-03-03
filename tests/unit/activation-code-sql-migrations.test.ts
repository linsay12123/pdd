import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationPaths = [
  "/Users/jeffo/Desktop/自动写作/.worktrees/bootstrap-shell/supabase/migrations/202603030004_activation_redeem_rpc.sql",
  "/Users/jeffo/Desktop/自动写作/.worktrees/bootstrap-shell/supabase/migrations/202603030008_activation_redeem_atomic_ledger.sql"
];

describe("activation code sql migrations", () => {
  it("qualifies activation_codes.code inside the redeem function", () => {
    for (const migrationPath of migrationPaths) {
      const sql = readFileSync(migrationPath, "utf8");

      expect(sql).toContain("update public.activation_codes as ac");
      expect(sql).toContain("where ac.code = v_code");
      expect(sql).not.toContain("where code = v_code");
    }
  });
});

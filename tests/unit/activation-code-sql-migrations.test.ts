import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = resolve(__dirname, "../../supabase/migrations");

const migrationPaths = [
  resolve(migrationsDir, "202603030004_activation_redeem_rpc.sql"),
  resolve(migrationsDir, "202603030008_activation_redeem_atomic_ledger.sql")
];
const fixMigrationPath = resolve(
  migrationsDir,
  "202603080001_fix_wallet_rpc_column_qualification.sql"
);

describe("activation code sql migrations", () => {
  it("qualifies activation_codes.code inside the redeem function", () => {
    for (const migrationPath of migrationPaths) {
      const sql = readFileSync(migrationPath, "utf8");

      expect(sql).toContain("update public.activation_codes as ac");
      expect(sql).toContain("where ac.code = v_code");
      expect(sql).not.toContain("where code = v_code");
    }
  });

  it("rebuilds activation-code wallet credit functions without bare quota column references", () => {
    const sql = readFileSync(fixMigrationPath, "utf8");

    expect(sql).toContain("create or replace function public.redeem_activation_code_and_credit_wallet");
    expect(sql).toContain("update public.quota_wallets as qw");
    expect(sql).toContain("set recharge_quota = qw.recharge_quota + v_quota");
    expect(sql).toContain("where qw.user_id = p_user_id");
    expect(sql).toContain("returning qw.recharge_quota, qw.frozen_quota");
  });
});

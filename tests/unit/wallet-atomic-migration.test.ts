import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = resolve(__dirname, "../../supabase/migrations");
const fixMigrationPath = resolve(
  migrationsDir,
  "202603080001_fix_wallet_rpc_column_qualification.sql"
);

describe("wallet atomic mutation migration", () => {
  it("defines the atomic wallet+ledger RPC used by charging/refunding routes", () => {
    const migrationPath = resolve(
      migrationsDir,
      "202603050003_wallet_atomic_mutation.sql"
    );
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("create or replace function public.apply_quota_wallet_mutation");
    expect(sql).toContain("insert into public.quota_ledger_entries");
    expect(sql).toContain("update public.quota_wallets");
  });

  it("rebuilds the wallet mutation RPC with fully qualified wallet columns", () => {
    const sql = readFileSync(fixMigrationPath, "utf8");

    expect(sql).toContain("create or replace function public.apply_quota_wallet_mutation");
    expect(sql).toContain("update public.quota_wallets as qw");
    expect(sql).toContain("where qw.user_id = p_user_id");
    expect(sql).toContain("and qw.recharge_quota = p_expected_recharge");
    expect(sql).toContain("and qw.subscription_quota = p_expected_subscription");
    expect(sql).toContain("and qw.frozen_quota = p_expected_frozen");
    expect(sql).toContain("returning qw.recharge_quota, qw.subscription_quota, qw.frozen_quota");
    expect(sql).not.toContain("where user_id = p_user_id");
    expect(sql).not.toContain("and recharge_quota = p_expected_recharge");
    expect(sql).not.toContain("and subscription_quota = p_expected_subscription");
    expect(sql).not.toContain("and frozen_quota = p_expected_frozen");
    expect(sql).not.toContain("returning quota_wallets.recharge_quota");
  });
});

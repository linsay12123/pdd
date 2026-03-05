import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = resolve(__dirname, "../../supabase/migrations");

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
});

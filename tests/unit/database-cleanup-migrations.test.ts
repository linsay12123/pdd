import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = resolve(__dirname, "../../supabase/migrations");
const taskAnalysisMigration = resolve(
  migrationsDir,
  "202603040002_task_analysis_pipeline.sql"
);
const cleanupMigration = resolve(
  migrationsDir,
  "202603040003_remove_legacy_payment_and_task_states.sql"
);
const undetectableHumanizeMigration = resolve(
  migrationsDir,
  "202603050001_undetectable_humanize_flow.sql"
);

describe("database cleanup migrations", () => {
  it("keeps task creation nullable until model analysis fills the requirements", () => {
    const sql = readFileSync(taskAnalysisMigration, "utf8");

    expect(sql).toContain("alter column target_word_count drop not null");
    expect(sql).toContain("alter column citation_style drop not null");
  });

  it("ships a cleanup migration that removes legacy payment structures and old task states", () => {
    expect(existsSync(cleanupMigration)).toBe(true);

    const sql = readFileSync(cleanupMigration, "utf8");

    expect(sql).toContain("drop table if exists public.payment_attempts");
    expect(sql).toContain("drop table if exists public.orders");
    expect(sql).toContain("drop table if exists public.pricing_plans");
    expect(sql).toContain("drop table if exists public.subscriptions");
    expect(sql).toContain("drop type if exists public.payment_provider");
    expect(sql).toContain("drop type if exists public.order_status");
    expect(sql).toContain("drop type if exists public.pricing_plan_kind");
    expect(sql).toContain("drop type if exists public.pricing_plan_status");
    expect(sql).toContain("drop type if exists public.payment_attempt_status");
    expect(sql).toContain("quota_frozen");
    expect(sql).toContain("outline_ready");
    expect(sql).toContain("awaiting_outline_approval");
    expect(sql).toContain("create or replace function public.get_app_schema_health()");
  });

  it("ships a follow-up migration that turns humanize into an attached flow instead of a main task status", () => {
    expect(existsSync(undetectableHumanizeMigration)).toBe(true);

    const sql = readFileSync(undetectableHumanizeMigration, "utf8");

    expect(sql).toContain("create type public.humanize_status");
    expect(sql).toContain("add column if not exists humanize_status");
    expect(sql).toContain("add column if not exists humanize_provider");
    expect(sql).toContain("add column if not exists humanize_profile_snapshot");
    expect(sql).toContain("add column if not exists humanize_document_id");
    expect(sql).toContain("add column if not exists humanize_retry_document_id");
    expect(sql).toContain("add column if not exists humanize_error_message");
    expect(sql).toContain("add column if not exists humanize_requested_at");
    expect(sql).toContain("add column if not exists humanize_completed_at");
    expect(sql).toContain("humanizing");
    expect(sql).toContain("humanized_ready");
    expect(sql).toContain("deliverable_ready");
  });
});

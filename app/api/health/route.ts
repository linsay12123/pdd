import { NextResponse } from "next/server";
import { env } from "@/src/config/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, { ok: boolean; detail: string }> = {};

  // 1. Check Supabase URL
  checks.SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
    ? { ok: true, detail: env.NEXT_PUBLIC_SUPABASE_URL.slice(0, 40) + "..." }
    : { ok: false, detail: "未配置 NEXT_PUBLIC_SUPABASE_URL" };

  // 2. Check Supabase Anon Key
  checks.SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? { ok: true, detail: `已配置 (${env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length} 字符)` }
    : { ok: false, detail: "未配置 NEXT_PUBLIC_SUPABASE_ANON_KEY" };

  // 3. Check Supabase Service Role Key
  checks.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
    ? { ok: true, detail: `已配置 (${env.SUPABASE_SERVICE_ROLE_KEY.length} 字符)` }
    : { ok: false, detail: "未配置 SUPABASE_SERVICE_ROLE_KEY" };

  // 4. Check OpenAI API Key
  checks.OPENAI_API_KEY = env.OPENAI_API_KEY
    ? { ok: true, detail: `已配置 (${env.OPENAI_API_KEY.length} 字符)` }
    : { ok: false, detail: "未配置 OPENAI_API_KEY" };

  // 5. Check StealthGPT API Key
  checks.STEALTHGPT_API_KEY = env.STEALTHGPT_API_KEY
    ? { ok: true, detail: `已配置 (${env.STEALTHGPT_API_KEY.length} 字符)` }
    : { ok: false, detail: "未配置（降AI功能不可用）" };

  // 6. Check Trigger Secret Key
  checks.TRIGGER_SECRET_KEY = env.TRIGGER_SECRET_KEY
    ? { ok: true, detail: `已配置 (${env.TRIGGER_SECRET_KEY.length} 字符)` }
    : { ok: false, detail: "未配置（后台任务不可用）" };

  // 7. Try Supabase connection
  if (env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { createSupabaseAdminClient } = await import(
        "@/src/lib/supabase/admin"
      );
      const client = createSupabaseAdminClient();
      const { error } = await client
        .from("profiles")
        .select("id")
        .limit(1);

      checks.SUPABASE_DB_CONNECTION = error
        ? { ok: false, detail: `数据库连接失败: ${error.message}` }
        : { ok: true, detail: "数据库连接正常" };
    } catch (e) {
      checks.SUPABASE_DB_CONNECTION = {
        ok: false,
        detail: `连接异常: ${e instanceof Error ? e.message : String(e)}`
      };
    }
  } else {
    checks.SUPABASE_DB_CONNECTION = {
      ok: false,
      detail: "跳过 — Supabase 凭据未配置"
    };
  }

  // 8. Check required DB tables
  if (checks.SUPABASE_DB_CONNECTION?.ok) {
    try {
      const { createSupabaseAdminClient } = await import(
        "@/src/lib/supabase/admin"
      );
      const client = createSupabaseAdminClient();

      const tables = [
        "profiles",
        "quota_wallets",
        "quota_ledger_entries",
        "writing_tasks",
        "task_files",
        "outline_versions",
        "draft_versions",
        "task_outputs"
      ];

      const missing: string[] = [];
      for (const table of tables) {
        const { error } = await client.from(table).select("*").limit(0);
        if (error) missing.push(`${table}: ${error.message}`);
      }

      checks.DB_TABLES = missing.length === 0
        ? { ok: true, detail: `全部 ${tables.length} 张表存在` }
        : { ok: false, detail: `缺失: ${missing.join("; ")}` };
    } catch (e) {
      checks.DB_TABLES = {
        ok: false,
        detail: `检查失败: ${e instanceof Error ? e.message : String(e)}`
      };
    }
  }

  const requiredKeys = [
    "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY",
    "OPENAI_API_KEY", "SUPABASE_DB_CONNECTION", "DB_TABLES"
  ];
  const allOk = requiredKeys.every((k) => checks[k]?.ok);

  return NextResponse.json(
    {
      status: allOk ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      checks
    },
    { status: allOk ? 200 : 503 }
  );
}

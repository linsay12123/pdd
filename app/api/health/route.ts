import { NextResponse } from "next/server";
import { env } from "@/src/config/env";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

export const dynamic = "force-dynamic";

type SchemaHealthPayload = {
  targetWordCountNullable: boolean;
  citationStyleNullable: boolean;
  analysisFieldsReady: boolean;
  taskFileFieldsReady: boolean;
  legacyPaymentTablesRemaining: string[];
  legacyPaymentTypesRemaining: string[];
  legacyTaskStatusesRemaining: string[];
};

type HealthRouteDependencies = {
  runtimeEnv?: typeof env;
  createClient?: typeof createSupabaseAdminClient;
};

function normalizeSchemaHealth(data: unknown): SchemaHealthPayload | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }

  const payload = data as Partial<SchemaHealthPayload>;

  return {
    targetWordCountNullable: payload.targetWordCountNullable === true,
    citationStyleNullable: payload.citationStyleNullable === true,
    analysisFieldsReady: payload.analysisFieldsReady === true,
    taskFileFieldsReady: payload.taskFileFieldsReady === true,
    legacyPaymentTablesRemaining: Array.isArray(payload.legacyPaymentTablesRemaining)
      ? payload.legacyPaymentTablesRemaining.map(String)
      : [],
    legacyPaymentTypesRemaining: Array.isArray(payload.legacyPaymentTypesRemaining)
      ? payload.legacyPaymentTypesRemaining.map(String)
      : [],
    legacyTaskStatusesRemaining: Array.isArray(payload.legacyTaskStatusesRemaining)
      ? payload.legacyTaskStatusesRemaining.map(String)
      : []
  };
}

export async function handleHealthRequest(
  dependencies: HealthRouteDependencies = {}
) {
  const runtimeEnv = dependencies.runtimeEnv ?? env;
  const checks: Record<string, { ok: boolean; detail: string }> = {};

  // 1. Check Supabase URL
  checks.SUPABASE_URL = runtimeEnv.NEXT_PUBLIC_SUPABASE_URL
    ? { ok: true, detail: runtimeEnv.NEXT_PUBLIC_SUPABASE_URL.slice(0, 40) + "..." }
    : { ok: false, detail: "未配置 NEXT_PUBLIC_SUPABASE_URL" };

  // 2. Check Supabase Anon Key
  checks.SUPABASE_ANON_KEY = runtimeEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? { ok: true, detail: `已配置 (${runtimeEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY.length} 字符)` }
    : { ok: false, detail: "未配置 NEXT_PUBLIC_SUPABASE_ANON_KEY" };

  // 3. Check Supabase Service Role Key
  checks.SUPABASE_SERVICE_ROLE_KEY = runtimeEnv.SUPABASE_SERVICE_ROLE_KEY
    ? { ok: true, detail: `已配置 (${runtimeEnv.SUPABASE_SERVICE_ROLE_KEY.length} 字符)` }
    : { ok: false, detail: "未配置 SUPABASE_SERVICE_ROLE_KEY" };

  // 4. Check OpenAI API Key
  checks.OPENAI_API_KEY = runtimeEnv.OPENAI_API_KEY
    ? { ok: true, detail: `已配置 (${runtimeEnv.OPENAI_API_KEY.length} 字符)` }
    : { ok: false, detail: "未配置 OPENAI_API_KEY" };

  // 5. Check StealthGPT API Key
  checks.STEALTHGPT_API_KEY = runtimeEnv.STEALTHGPT_API_KEY
    ? { ok: true, detail: `已配置 (${runtimeEnv.STEALTHGPT_API_KEY.length} 字符)` }
    : { ok: false, detail: "未配置（降AI功能不可用）" };

  // 6. Check Trigger Secret Key
  checks.TRIGGER_SECRET_KEY = runtimeEnv.TRIGGER_SECRET_KEY
    ? { ok: true, detail: `已配置 (${runtimeEnv.TRIGGER_SECRET_KEY.length} 字符)` }
    : { ok: false, detail: "未配置（后台任务不可用）" };

  // 7. Try Supabase connection
  if (runtimeEnv.NEXT_PUBLIC_SUPABASE_URL && runtimeEnv.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const client = (dependencies.createClient ?? createSupabaseAdminClient)();
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
      const client = (dependencies.createClient ?? createSupabaseAdminClient)();

      const tables = [
        "profiles",
        "quota_wallets",
        "quota_ledger_entries",
        "activation_codes",
        "writing_tasks",
        "task_files",
        "outline_versions",
        "draft_versions",
        "reference_checks",
        "task_outputs",
        "admin_audit_logs"
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

  if (checks.SUPABASE_DB_CONNECTION?.ok) {
    try {
      const client = (dependencies.createClient ?? createSupabaseAdminClient)();
      const { data, error } = await client.rpc("get_app_schema_health");

      if (error) {
        checks.DB_SCHEMA_COMPAT = {
          ok: false,
          detail: `结构检查失败：${error.message}`
        };
        checks.DB_LEGACY_STRUCTURES = {
          ok: false,
          detail: "无法确认旧表和旧状态是否已经清理干净。"
        };
      } else {
        const schema = normalizeSchemaHealth(data);

        if (!schema) {
          checks.DB_SCHEMA_COMPAT = {
            ok: false,
            detail: "结构检查函数返回了无效结果。"
          };
          checks.DB_LEGACY_STRUCTURES = {
            ok: false,
            detail: "无法解析旧结构检查结果。"
          };
        } else {
          const schemaProblems: string[] = [];

          if (!schema.targetWordCountNullable) {
            schemaProblems.push("writing_tasks.target_word_count 还不允许空值");
          }

          if (!schema.citationStyleNullable) {
            schemaProblems.push("writing_tasks.citation_style 还不允许空值");
          }

          if (!schema.analysisFieldsReady) {
            schemaProblems.push("writing_tasks 的分析字段还没补齐");
          }

          if (!schema.taskFileFieldsReady) {
            schemaProblems.push("task_files 的 OpenAI 文件字段还没补齐");
          }

          const legacyProblems = [
            ...schema.legacyPaymentTablesRemaining,
            ...schema.legacyPaymentTypesRemaining,
            ...schema.legacyTaskStatusesRemaining
          ];

          checks.DB_SCHEMA_COMPAT = schemaProblems.length === 0
            ? { ok: true, detail: "数据库结构已跟上当前写作流程" }
            : { ok: false, detail: schemaProblems.join("；") };

          checks.DB_LEGACY_STRUCTURES = legacyProblems.length === 0
            ? { ok: true, detail: "旧支付表、旧类型和旧任务状态都已清理" }
            : { ok: false, detail: `仍残留：${legacyProblems.join("、")}` };
        }
      }
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      checks.DB_SCHEMA_COMPAT = {
        ok: false,
        detail: `结构检查异常：${detail}`
      };
      checks.DB_LEGACY_STRUCTURES = {
        ok: false,
        detail: `旧结构检查异常：${detail}`
      };
    }
  }

  const requiredKeys = [
    "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY",
    "OPENAI_API_KEY", "SUPABASE_DB_CONNECTION", "DB_TABLES",
    "DB_SCHEMA_COMPAT", "DB_LEGACY_STRUCTURES"
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

export async function GET() {
  return handleHealthRequest();
}

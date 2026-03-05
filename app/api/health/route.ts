import { NextResponse } from "next/server";
import { runs } from "@trigger.dev/sdk/v3";
import { env } from "@/src/config/env";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { getInvalidTriggerKeyReason } from "@/src/lib/trigger/key-guard";

export const dynamic = "force-dynamic";

type SchemaHealthPayload = {
  targetWordCountNullable: boolean;
  citationStyleNullable: boolean;
  analysisFieldsReady: boolean;
  taskFileFieldsReady: boolean;
  humanizeFieldsReady: boolean;
  legacyPaymentTablesRemaining: string[];
  legacyPaymentTypesRemaining: string[];
  legacyTaskStatusesRemaining: string[];
};

type HealthRouteDependencies = {
  runtimeEnv?: typeof env;
  createClient?: typeof createSupabaseAdminClient;
  checkTriggerRuntime?: () => Promise<{ ok: boolean; detail: string }>;
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
    humanizeFieldsReady: payload.humanizeFieldsReady === true,
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

  // 5. Check Undetectable API Key
  checks.UNDETECTABLE_API_KEY = runtimeEnv.UNDETECTABLE_API_KEY
    ? { ok: true, detail: `已配置 (${runtimeEnv.UNDETECTABLE_API_KEY.length} 字符)` }
    : { ok: false, detail: "未配置（Undetectable 降AI功能不可用）" };

  // 6. Check Trigger Secret Key
  const triggerKeyInvalidReason = getInvalidTriggerKeyReason({
    triggerSecretKey: runtimeEnv.TRIGGER_SECRET_KEY,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV
  });
  checks.TRIGGER_SECRET_KEY =
    triggerKeyInvalidReason === "missing"
      ? { ok: false, detail: "未配置（后台任务不可用）" }
      : triggerKeyInvalidReason === "dev_key_in_production"
        ? { ok: false, detail: "生产环境不能使用 tr_dev_，请改成生产密钥（通常是 tr_prod_）。" }
        : { ok: true, detail: `已配置 (${runtimeEnv.TRIGGER_SECRET_KEY.length} 字符)` };

  checks.TRIGGER_RUNTIME =
    checks.TRIGGER_SECRET_KEY.ok
      ? await (dependencies.checkTriggerRuntime ?? checkTriggerRuntime)()
      : { ok: false, detail: "跳过 — TRIGGER_SECRET_KEY 未就绪" };

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

          if (!schema.humanizeFieldsReady) {
            schemaProblems.push("writing_tasks 的降AI附加字段还没补齐");
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
    "OPENAI_API_KEY", "UNDETECTABLE_API_KEY", "TRIGGER_SECRET_KEY",
    "TRIGGER_RUNTIME",
    "SUPABASE_DB_CONNECTION", "DB_TABLES",
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

async function checkTriggerRuntime() {
  try {
    const page = await runs.list({
      limit: 20,
      taskIdentifier: "analyze-uploaded-task"
    });
    const items = Array.isArray((page as { data?: unknown[] } | null | undefined)?.data)
      ? ((page as { data: unknown[] }).data)
      : [];
    const statuses = items
      .map((item) => {
        const status = (item as { status?: unknown } | null | undefined)?.status;
        return typeof status === "string" ? status : null;
      })
      .filter((status): status is string => Boolean(status));

    if (items.length === 0) {
      return {
        ok: false,
        detail:
          "Trigger Runtime 可访问，但还没有 analyze-uploaded-task 的运行记录，暂时无法确认任务版本是否已部署。"
      };
    }

    const hasRealRuntimeStatus = statuses.some((status) => status !== "PENDING_VERSION");
    if (!hasRealRuntimeStatus) {
      return {
        ok: false,
        detail:
          "Trigger Runtime 可访问，但最近记录仍全部是 PENDING_VERSION（任务版本还没部署到生产）。"
      };
    }

    const latestStableStatus = statuses.find((status) => status !== "PENDING_VERSION") ?? "unknown";

    return {
      ok: true,
      detail: `Trigger Runtime 可访问，analyze-uploaded-task 最近有效状态：${latestStableStatus}。`
    };
  } catch (error) {
    return {
      ok: false,
      detail: `Trigger Runtime API 检查失败：${
        error instanceof Error ? error.message : String(error)
      }`
    };
  }
}

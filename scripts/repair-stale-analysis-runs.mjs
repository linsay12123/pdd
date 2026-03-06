import { createClient } from "@supabase/supabase-js";
import { runs } from "@trigger.dev/sdk/v3";

const STALE_TRIGGER_RUN_REASON = "STALE_TRIGGER_RUN";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const allPending = args.includes("--all-pending");
const force = args.includes("--force");
const limit = readNumericFlag(args, "--limit") ?? 50;
const taskIds = args.filter((arg) => !arg.startsWith("--"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const triggerSecretKey = process.env.TRIGGER_SECRET_KEY?.trim();

if (!supabaseUrl || !serviceRoleKey) {
  console.error("缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY，不能修旧坏任务。");
  process.exit(1);
}

if (!force && !triggerSecretKey) {
  console.error("缺少 TRIGGER_SECRET_KEY，脚本没法判断哪条后台编号是真的坏。可补上密钥，或者明确加 --force。");
  process.exit(1);
}

if (!allPending && taskIds.length === 0) {
  console.error("请传具体 taskId，或者加 --all-pending。");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

const rows = await loadCandidateTasks();

if (rows.length === 0) {
  console.log("没有找到需要修复的任务。");
  process.exit(0);
}

console.log(`准备检查 ${rows.length} 条任务。`);

let repaired = 0;
let skipped = 0;

for (const row of rows) {
  const shouldRepair = force ? true : await isPendingVersionRun(row.analysis_trigger_run_id);

  if (!shouldRepair) {
    skipped += 1;
    console.log(`跳过 ${row.id}：这条后台编号不是 PENDING_VERSION。`);
    continue;
  }

  const patch = {
    analysis_status: "failed",
    analysis_model:
      typeof row.analysis_model === "string" && row.analysis_model.trim().length > 0
        ? row.analysis_model === "analysis_auto_recovered_once"
          ? "gpt-5.2"
          : row.analysis_model
        : "gpt-5.2",
    analysis_error_message: STALE_TRIGGER_RUN_REASON,
    analysis_trigger_run_id: null,
    analysis_started_at: null,
    analysis_completed_at: new Date().toISOString(),
    analysis_snapshot: null
  };

  if (dryRun) {
    repaired += 1;
    console.log(`[dry-run] 会修复 ${row.id}`, patch);
    continue;
  }

  const { error } = await supabase
    .from("writing_tasks")
    .update(patch)
    .eq("id", row.id);

  if (error) {
    console.error(`修复 ${row.id} 失败：${error.message}`);
    process.exitCode = 1;
    continue;
  }

  repaired += 1;
  console.log(`已修复 ${row.id}：旧坏后台编号已清掉，现在可以手动点“一键重试分析”。`);
}

console.log(`完成。修复 ${repaired} 条，跳过 ${skipped} 条。`);

async function loadCandidateTasks() {
  let query = supabase
    .from("writing_tasks")
    .select(
      "id,analysis_status,analysis_model,analysis_trigger_run_id,analysis_requested_at,analysis_started_at"
    )
    .not("analysis_trigger_run_id", "is", null)
    .order("analysis_requested_at", { ascending: false })
    .limit(limit);

  if (allPending) {
    query = query.eq("analysis_status", "pending");
  } else {
    query = query.in("id", taskIds);
  }

  const { data, error } = await query;
  if (error) {
    console.error(`读取候选任务失败：${error.message}`);
    process.exit(1);
  }

  return Array.isArray(data) ? data : [];
}

async function isPendingVersionRun(runId) {
  if (!runId || !triggerSecretKey) {
    return false;
  }

  try {
    const run = await runs.retrieve(runId);
    return run?.status === "PENDING_VERSION";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("not found")) {
      return true;
    }

    throw error;
  }
}

function readNumericFlag(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) {
    return null;
  }

  const raw = argv[index + 1];
  const value = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(value) ? value : null;
}

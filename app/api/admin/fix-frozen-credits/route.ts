import { NextResponse } from "next/server";
import { requireAdminSession } from "@/src/lib/auth/admin-guard";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

export const maxDuration = 30;

export async function POST() {
  try {
    await requireAdminSession();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "AUTH_REQUIRED") {
      return NextResponse.json({ ok: false, message: "请先登录。" }, { status: 401 });
    }
    if (message === "ADMIN_REQUIRED") {
      return NextResponse.json({ ok: false, message: "需要管理员权限。" }, { status: 403 });
    }
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }

  const client = createSupabaseAdminClient();

  // Find all tasks stuck in quota_frozen
  // Try with quota_reservation first, fall back without it if column doesn't exist
  let frozenTasks: Array<{
    id: string;
    user_id: string;
    quota_reservation?: unknown;
    status: string;
  }> | null = null;
  let taskError: { message: string } | null = null;

  const result = await client
    .from("writing_tasks")
    .select("id,user_id,quota_reservation,status")
    .eq("status", "quota_frozen");

  if (result.error?.message?.includes("quota_reservation")) {
    // Column doesn't exist yet, query without it
    const fallback = await client
      .from("writing_tasks")
      .select("id,user_id,status")
      .eq("status", "quota_frozen");
    frozenTasks = fallback.data;
    taskError = fallback.error;
  } else {
    frozenTasks = result.data;
    taskError = result.error;
  }

  if (taskError) {
    return NextResponse.json(
      { ok: false, message: `查询冻结任务失败：${taskError.message}` },
      { status: 500 }
    );
  }

  if (!frozenTasks || frozenTasks.length === 0) {
    return NextResponse.json({
      ok: true,
      message: "没有找到需要修复的冻结任务。",
      fixed: 0
    });
  }

  const results: Array<{
    taskId: string;
    userId: string;
    amount: number;
    success: boolean;
    error?: string;
  }> = [];

  for (const task of frozenTasks) {
    const reservation = (task.quota_reservation ?? null) as {
      totalAmount?: number;
      fromSubscription?: number;
      fromRecharge?: number;
      chargePath?: string;
    } | null;

    let totalAmount = reservation?.totalAmount ?? 0;
    let fromSubscription = reservation?.fromSubscription ?? 0;
    let fromRecharge = reservation?.fromRecharge ?? 0;

    // If no reservation stored, reconstruct from ledger
    if (totalAmount <= 0) {
      const { data: ledgerRow } = await client
        .from("quota_ledger_entries")
        .select("amount")
        .eq("task_id", task.id)
        .eq("user_id", task.user_id)
        .eq("entry_kind", "task_freeze")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ledgerRow?.amount) {
        totalAmount = Number(ledgerRow.amount);
        fromRecharge = totalAmount;
        fromSubscription = 0;
      }
    }

    if (totalAmount <= 0) {
      // Still no info, just mark as failed
      await client
        .from("writing_tasks")
        .update({ status: "failed" })
        .eq("id", task.id);

      results.push({
        taskId: task.id,
        userId: task.user_id,
        amount: 0,
        success: true
      });
      continue;
    }

    // Load current wallet
    const { data: walletRow, error: walletError } = await client
      .from("quota_wallets")
      .select("recharge_quota,subscription_quota,frozen_quota")
      .eq("user_id", task.user_id)
      .maybeSingle();

    if (walletError || !walletRow) {
      results.push({
        taskId: task.id,
        userId: task.user_id,
        amount: totalAmount,
        success: false,
        error: walletError?.message ?? "钱包不存在"
      });
      continue;
    }

    // Release: restore subscription/recharge, reduce frozen
    const newRecharge = Number(walletRow.recharge_quota) + fromRecharge;
    const newSubscription = Number(walletRow.subscription_quota) + fromSubscription;
    const newFrozen = Math.max(0, Number(walletRow.frozen_quota) - totalAmount);

    const { error: updateError } = await client
      .from("quota_wallets")
      .update({
        recharge_quota: newRecharge,
        subscription_quota: newSubscription,
        frozen_quota: newFrozen
      })
      .eq("user_id", task.user_id);

    if (updateError) {
      results.push({
        taskId: task.id,
        userId: task.user_id,
        amount: totalAmount,
        success: false,
        error: updateError.message
      });
      continue;
    }

    // Write ledger entry
    await client
      .from("quota_ledger_entries")
      .insert({
        user_id: task.user_id,
        task_id: task.id,
        entry_kind: "task_release",
        amount: totalAmount,
        balance_recharge_after: newRecharge,
        balance_subscription_after: newSubscription,
        balance_frozen_after: newFrozen,
        unique_event_key: `${task.id}:admin_fix_release:${totalAmount}`,
        metadata: { note: `Admin fix: released ${totalAmount} frozen quota` }
      });

    // Mark task as failed
    await client
      .from("writing_tasks")
      .update({ status: "failed" })
      .eq("id", task.id);

    results.push({
      taskId: task.id,
      userId: task.user_id,
      amount: totalAmount,
      success: true
    });
  }

  const totalFixed = results.filter((r) => r.success).length;
  const totalReleased = results
    .filter((r) => r.success)
    .reduce((sum, r) => sum + r.amount, 0);

  return NextResponse.json({
    ok: true,
    message: `已修复 ${totalFixed} 个冻结任务，共释放 ${totalReleased} 积分。`,
    fixed: totalFixed,
    totalReleased,
    details: results
  });
}

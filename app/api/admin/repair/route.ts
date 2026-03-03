import { NextResponse } from "next/server";
import { env } from "@/src/config/env";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // Authenticate via bearer token = SUPABASE_SERVICE_ROLE_KEY
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token || token !== env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  const client = createSupabaseAdminClient();
  const steps: Array<{ step: string; ok: boolean; detail: string }> = [];

  // Step 1: Try to add quota_reservation column (idempotent)
  try {
    const { error } = await client.rpc("exec_sql", {
      query: "ALTER TABLE public.writing_tasks ADD COLUMN IF NOT EXISTS quota_reservation jsonb;"
    });
    if (error) {
      // rpc might not exist, try a different approach — just test if column works
      const { error: testError } = await client
        .from("writing_tasks")
        .select("quota_reservation")
        .limit(0);

      if (testError?.message?.includes("quota_reservation")) {
        steps.push({
          step: "add_quota_reservation_column",
          ok: false,
          detail: "Column doesn't exist and cannot be added via API. Run in SQL Editor: ALTER TABLE public.writing_tasks ADD COLUMN IF NOT EXISTS quota_reservation jsonb;"
        });
      } else {
        steps.push({
          step: "add_quota_reservation_column",
          ok: true,
          detail: "Column already exists"
        });
      }
    } else {
      steps.push({
        step: "add_quota_reservation_column",
        ok: true,
        detail: "Column added or already exists"
      });
    }
  } catch (e) {
    // Test if column already works
    const { error: testError } = await client
      .from("writing_tasks")
      .select("quota_reservation")
      .limit(0);

    steps.push({
      step: "add_quota_reservation_column",
      ok: !testError,
      detail: testError
        ? "Column missing. Run in SQL Editor: ALTER TABLE public.writing_tasks ADD COLUMN IF NOT EXISTS quota_reservation jsonb;"
        : "Column already exists"
    });
  }

  // Step 2: Find and fix all frozen tasks
  let frozenTasks: Array<{
    id: string;
    user_id: string;
    quota_reservation?: unknown;
  }> | null = null;

  const result = await client
    .from("writing_tasks")
    .select("id,user_id,quota_reservation")
    .eq("status", "quota_frozen");

  if (result.error?.message?.includes("quota_reservation")) {
    const fallback = await client
      .from("writing_tasks")
      .select("id,user_id")
      .eq("status", "quota_frozen");
    frozenTasks = fallback.data;
  } else {
    frozenTasks = result.data;
  }

  if (!frozenTasks || frozenTasks.length === 0) {
    steps.push({
      step: "fix_frozen_credits",
      ok: true,
      detail: "No frozen tasks found"
    });
    return NextResponse.json({ ok: true, steps });
  }

  let totalFixed = 0;
  let totalReleased = 0;
  const taskDetails: Array<{ taskId: string; userId: string; amount: number; ok: boolean }> = [];

  for (const task of frozenTasks) {
    const reservation = (task.quota_reservation ?? null) as {
      totalAmount?: number;
      fromSubscription?: number;
      fromRecharge?: number;
    } | null;

    let totalAmount = reservation?.totalAmount ?? 0;
    let fromSubscription = reservation?.fromSubscription ?? 0;
    let fromRecharge = reservation?.fromRecharge ?? 0;

    // Reconstruct from ledger if needed
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
      // No amount info, just mark as failed
      await client.from("writing_tasks").update({ status: "failed" }).eq("id", task.id);
      taskDetails.push({ taskId: task.id, userId: task.user_id, amount: 0, ok: true });
      totalFixed++;
      continue;
    }

    // Load wallet
    const { data: walletRow } = await client
      .from("quota_wallets")
      .select("recharge_quota,subscription_quota,frozen_quota")
      .eq("user_id", task.user_id)
      .maybeSingle();

    if (!walletRow) {
      taskDetails.push({ taskId: task.id, userId: task.user_id, amount: totalAmount, ok: false });
      continue;
    }

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
      taskDetails.push({ taskId: task.id, userId: task.user_id, amount: totalAmount, ok: false });
      continue;
    }

    // Write ledger
    await client.from("quota_ledger_entries").insert({
      user_id: task.user_id,
      task_id: task.id,
      entry_kind: "task_release",
      amount: totalAmount,
      balance_recharge_after: newRecharge,
      balance_subscription_after: newSubscription,
      balance_frozen_after: newFrozen,
      unique_event_key: `${task.id}:repair_release:${totalAmount}`,
      metadata: { note: `Repair: released ${totalAmount} frozen quota` }
    });

    // Mark task as failed
    await client.from("writing_tasks").update({ status: "failed" }).eq("id", task.id);

    taskDetails.push({ taskId: task.id, userId: task.user_id, amount: totalAmount, ok: true });
    totalFixed++;
    totalReleased += totalAmount;
  }

  steps.push({
    step: "fix_frozen_credits",
    ok: true,
    detail: `Fixed ${totalFixed}/${frozenTasks.length} tasks, released ${totalReleased} credits`
  });

  return NextResponse.json({
    ok: true,
    steps,
    taskDetails,
    summary: {
      totalFrozenTasks: frozenTasks.length,
      totalFixed,
      totalReleased
    }
  });
}

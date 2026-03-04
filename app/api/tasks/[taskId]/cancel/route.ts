import { NextResponse } from "next/server";
import { requireCurrentSessionUser } from "@/src/lib/auth/current-user";
import { releaseQuota } from "@/src/lib/billing/release-quota";
import {
  appendPaymentLedgerEntry,
  getUserWallet,
  setUserWallet
} from "@/src/lib/payments/repository";
import {
  getTaskSummary,
  updateTaskStatus
} from "@/src/lib/tasks/repository";
import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import type { SessionUser } from "@/src/types/auth";
import type { FrozenQuotaReservation } from "@/src/types/billing";

export const maxDuration = 30;

type RouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

type CancelRouteDependencies = {
  requireUser?: () => Promise<SessionUser>;
};

const CANCELLABLE_STATUSES = new Set([
  "created",
  "awaiting_primary_file_confirmation",
  "awaiting_outline_approval"
]);

export async function handleCancelRequest(
  _request: Request,
  context: RouteContext,
  dependencies: CancelRouteDependencies = {}
) {
  const { taskId } = await context.params;

  let user: SessionUser;
  try {
    user = await (dependencies.requireUser ?? requireCurrentSessionUser)();
  } catch {
    return NextResponse.json(
      { ok: false, taskId, message: "请先登录。" },
      { status: 401 }
    );
  }

  return shouldUseSupabasePersistence()
    ? cancelWithSupabase(taskId, user)
    : cancelLocally(taskId, user);
}

function cancelLocally(taskId: string, user: SessionUser) {
  const task = getTaskSummary(taskId);

  if (!task || task.userId !== user.id) {
    return NextResponse.json(
      { ok: false, taskId, message: "未找到这个任务。" },
      { status: 404 }
    );
  }

  if (!CANCELLABLE_STATUSES.has(task.status)) {
    return NextResponse.json(
      { ok: false, taskId, message: "当前任务状态不允许取消。" },
      { status: 400 }
    );
  }

  const reservation = task.quotaReservation;

  // If quota was frozen (post-outline-approval), release it
  if (reservation && reservation.totalAmount > 0) {
    const wallet = getUserWallet(user.id);
    const released = releaseQuota({ wallet, reservation });
    setUserWallet(user.id, released.wallet);
    appendPaymentLedgerEntry(user.id, released.entry);
    updateTaskStatus(taskId, "failed");

    return NextResponse.json(
      {
        ok: true,
        taskId,
        releasedQuota: reservation.totalAmount,
        message: "任务已取消，积分已返还。"
      },
      { status: 200 }
    );
  }

  // No quota was frozen (pre-outline-approval), just mark as failed
  updateTaskStatus(taskId, "failed");

  return NextResponse.json(
    {
      ok: true,
      taskId,
      releasedQuota: 0,
      message: "任务已取消。"
    },
    { status: 200 }
  );
}

async function cancelWithSupabase(taskId: string, user: SessionUser) {
  const client = createSupabaseAdminClient();

  // 1. Load task with quota_reservation
  const { data: taskRow, error: taskError } = await client
    .from("writing_tasks")
    .select("id,status,quota_reservation")
    .eq("id", taskId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (taskError) {
    console.error("[task-cancel] 查询任务失败:", taskError.message);
    return NextResponse.json(
      { ok: false, taskId, message: `查询任务失败：${taskError.message}` },
      { status: 500 }
    );
  }

  if (!taskRow) {
    return NextResponse.json(
      { ok: false, taskId, message: "未找到这个任务。" },
      { status: 404 }
    );
  }

  if (!CANCELLABLE_STATUSES.has(taskRow.status)) {
    return NextResponse.json(
      { ok: false, taskId, message: "当前任务状态不允许取消。" },
      { status: 400 }
    );
  }

  const reservation = taskRow.quota_reservation as FrozenQuotaReservation | null;

  // If there's frozen quota to release, do so
  if (reservation && reservation.totalAmount > 0) {
    // 2. Load wallet
    const { data: walletRow, error: walletError } = await client
      .from("quota_wallets")
      .select("recharge_quota,subscription_quota,frozen_quota")
      .eq("user_id", user.id)
      .maybeSingle();

    if (walletError) {
      console.error("[task-cancel] 查询钱包失败:", walletError.message);
      return NextResponse.json(
        { ok: false, taskId, message: `查询钱包失败：${walletError.message}` },
        { status: 500 }
      );
    }

    const wallet = {
      rechargeQuota: Number(walletRow?.recharge_quota ?? 0),
      subscriptionQuota: Number(walletRow?.subscription_quota ?? 0),
      frozenQuota: Number(walletRow?.frozen_quota ?? 0)
    };

    // 3. Compute release
    const released = releaseQuota({ wallet, reservation });

    // 4. Update wallet
    const { error: walletUpdateError } = await client
      .from("quota_wallets")
      .update({
        recharge_quota: released.wallet.rechargeQuota,
        subscription_quota: released.wallet.subscriptionQuota,
        frozen_quota: released.wallet.frozenQuota
      })
      .eq("user_id", user.id);

    if (walletUpdateError) {
      console.error("[task-cancel] 更新钱包失败:", walletUpdateError.message);
      return NextResponse.json(
        { ok: false, taskId, message: `释放积分失败：${walletUpdateError.message}` },
        { status: 500 }
      );
    }

    // 5. Write ledger entry
    const { error: ledgerError } = await client
      .from("quota_ledger_entries")
      .insert({
        user_id: user.id,
        task_id: taskId,
        entry_kind: released.entry.kind,
        amount: released.entry.amount,
        balance_recharge_after: released.wallet.rechargeQuota,
        balance_subscription_after: released.wallet.subscriptionQuota,
        balance_frozen_after: released.wallet.frozenQuota,
        unique_event_key: released.entry.ledgerKey,
        metadata: {
          note: released.entry.note
        }
      });

    if (ledgerError) {
      console.error("[task-cancel] 写入流水失败:", ledgerError.message);
    }
  }

  // 6. Mark task as failed
  const { error: statusError } = await client
    .from("writing_tasks")
    .update({ status: "failed" })
    .eq("id", taskId)
    .eq("user_id", user.id);

  if (statusError) {
    console.error("[task-cancel] 更新任务状态失败:", statusError.message);
  }

  return NextResponse.json(
    {
      ok: true,
      taskId,
      releasedQuota: reservation?.totalAmount ?? 0,
      message: reservation?.totalAmount
        ? "任务已取消，积分已返还。"
        : "任务已取消。"
    },
    { status: 200 }
  );
}

export async function POST(request: Request, context: RouteContext) {
  return handleCancelRequest(request, context);
}

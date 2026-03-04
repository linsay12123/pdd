import { NextResponse } from "next/server";
import { requireCurrentSessionUser } from "@/src/lib/auth/current-user";
import { releaseQuota } from "@/src/lib/billing/release-quota";
import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import {
  appendPaymentLedgerEntryToSupabase,
  getUserWalletFromSupabase,
  setUserWalletInSupabase
} from "@/src/lib/payments/supabase-wallet";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import type { SessionUser } from "@/src/types/auth";
import type { FrozenQuotaReservation } from "@/src/types/billing";

export const maxDuration = 30;

type RouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

type CancelTaskContext = {
  taskId: string;
  userId: string;
  status: string;
  quotaReservation: FrozenQuotaReservation | null;
};

type CancelRouteDependencies = {
  requireUser?: () => Promise<SessionUser>;
  isPersistenceReady?: () => boolean;
  loadTask?: (taskId: string, userId: string) => Promise<CancelTaskContext | null>;
  releaseQuotaReservation?: (
    taskId: string,
    userId: string,
    reservation: FrozenQuotaReservation
  ) => Promise<void>;
  markTaskFailed?: (taskId: string, userId: string) => Promise<void>;
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

  if (!(dependencies.isPersistenceReady ?? shouldUseSupabasePersistence)()) {
    return NextResponse.json(
      { ok: false, taskId, message: "当前环境还没接入真实数据库，不能继续走正式取消流程。" },
      { status: 503 }
    );
  }

  try {
    const task = await (dependencies.loadTask ?? loadTaskWithSupabase)(taskId, user.id);

    if (!task) {
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

    if (task.quotaReservation && task.quotaReservation.totalAmount > 0) {
      await (dependencies.releaseQuotaReservation ?? releaseQuotaReservationWithSupabase)(
        taskId,
        user.id,
        task.quotaReservation
      );
    }

    await (dependencies.markTaskFailed ?? markTaskFailedWithSupabase)(taskId, user.id);

    return NextResponse.json(
      {
        ok: true,
        taskId,
        releasedQuota: task.quotaReservation?.totalAmount ?? 0,
        message: task.quotaReservation?.totalAmount
          ? "任务已取消，积分已返还。"
          : "任务已取消。"
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "REAL_PERSISTENCE_REQUIRED") {
      return NextResponse.json(
        { ok: false, taskId, message: "当前环境还没接入真实数据库，不能继续走正式取消流程。" },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        taskId,
        message: error instanceof Error ? error.message : "取消任务失败"
      },
      { status: 500 }
    );
  }
}

async function loadTaskWithSupabase(taskId: string, userId: string) {
  if (!shouldUseSupabasePersistence()) {
    throw new Error("REAL_PERSISTENCE_REQUIRED");
  }

  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("writing_tasks")
    .select("id,user_id,status,quota_reservation")
    .eq("id", taskId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`查询任务失败：${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    taskId: String(data.id),
    userId: String(data.user_id),
    status: String(data.status),
    quotaReservation: (data.quota_reservation as FrozenQuotaReservation | null) ?? null
  } satisfies CancelTaskContext;
}

async function releaseQuotaReservationWithSupabase(
  taskId: string,
  userId: string,
  reservation: FrozenQuotaReservation
) {
  if (!shouldUseSupabasePersistence()) {
    throw new Error("REAL_PERSISTENCE_REQUIRED");
  }

  const wallet = await getUserWalletFromSupabase(userId);
  const released = releaseQuota({ wallet, reservation });

  await setUserWalletInSupabase(userId, released.wallet);
  await appendPaymentLedgerEntryToSupabase({
    userId,
    taskId,
    entry: released.entry,
    walletAfter: released.wallet
  });
}

async function markTaskFailedWithSupabase(taskId: string, userId: string) {
  if (!shouldUseSupabasePersistence()) {
    throw new Error("REAL_PERSISTENCE_REQUIRED");
  }

  const client = createSupabaseAdminClient();
  const { error } = await client
    .from("writing_tasks")
    .update({
      status: "failed",
      quota_reservation: null
    })
    .eq("id", taskId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`更新任务状态失败：${error.message}`);
  }
}

export async function POST(request: Request, context: RouteContext) {
  return handleCancelRequest(request, context);
}

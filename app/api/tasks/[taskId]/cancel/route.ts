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
import type { SessionUser } from "@/src/types/auth";

type RouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

type CancelRouteDependencies = {
  requireUser?: () => Promise<SessionUser>;
};

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

  const task = getTaskSummary(taskId);

  if (!task || task.userId !== user.id) {
    return NextResponse.json(
      { ok: false, taskId, message: "未找到这个任务。" },
      { status: 404 }
    );
  }

  if (task.status !== "quota_frozen") {
    return NextResponse.json(
      { ok: false, taskId, message: "只能取消处于 quota_frozen 状态的任务。" },
      { status: 400 }
    );
  }

  const reservation = task.quotaReservation;

  if (!reservation) {
    return NextResponse.json(
      { ok: false, taskId, message: "缺少积分冻结信息，无法自动释放。" },
      { status: 400 }
    );
  }

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

export async function POST(request: Request, context: RouteContext) {
  return handleCancelRequest(request, context);
}

import { NextResponse } from "next/server";
import { requireCurrentSessionUser } from "@/src/lib/auth/current-user";
import { buildSafetyIdentifier } from "@/src/lib/ai/safety-identifier";
import { freezeQuota } from "@/src/lib/billing/freeze-quota";
import { releaseQuota } from "@/src/lib/billing/release-quota";
import { settleQuota } from "@/src/lib/billing/settle-quota";
import { countBodyWords } from "@/src/lib/drafts/word-count";
import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import {
  applyWalletMutationWithLedgerInSupabase,
  getUserWalletFromSupabase,
} from "@/src/lib/payments/supabase-wallet";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import {
  processApprovedTask,
  TaskProcessingStageError
} from "@/src/lib/tasks/process-approved-task";
import { approveOutlineVersion } from "@/src/lib/tasks/save-outline-version";
import { setOwnedTaskStatusInSupabase } from "@/src/lib/tasks/supabase-task-records";
import {
  toSessionTaskHumanizePayload,
  toSessionTaskPayload
} from "@/src/lib/tasks/session-task";
import { resolveGenerationTaskQuotaCost } from "@/src/lib/tasks/task-cost";
import type { SessionUser } from "@/src/types/auth";
import type { FrozenQuotaReservation } from "@/src/types/billing";

export const maxDuration = 300;

type RouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

type OutlineApproveBody = {
  outlineVersionId?: string;
};

type OutlineApproveDependencies = {
  requireUser?: () => Promise<SessionUser>;
  isPersistenceReady?: () => boolean;
  approveOutline?: typeof approveOutlineVersion;
  reserveQuotaForTask?: (
    taskId: string,
    userId: string
  ) => Promise<FrozenQuotaReservation>;
  settleQuotaForTask?: (
    taskId: string,
    userId: string,
    reservation: FrozenQuotaReservation
  ) => Promise<void>;
  releaseQuotaForTask?: (
    taskId: string,
    userId: string,
    reservation: FrozenQuotaReservation
  ) => Promise<void>;
  markTaskFailed?: (taskId: string, userId: string) => Promise<void>;
  processTask?: typeof processApprovedTask;
};

export async function handleOutlineApprovalRequest(
  request: Request,
  params: {
    taskId: string;
  },
  dependencies: OutlineApproveDependencies = {}
) {
  const body = (await request.json().catch(() => null)) as OutlineApproveBody | null;

  try {
    const user = await (dependencies.requireUser ?? requireCurrentSessionUser)();

    if (!(dependencies.isPersistenceReady ?? shouldUseSupabasePersistence)()) {
      return NextResponse.json(
        {
          ok: false,
          message: "当前环境还没接入真实数据库，不能继续走正式写作流程。"
        },
        { status: 503 }
      );
    }

    // 1. Approve the outline
    await (dependencies.approveOutline ?? approveOutlineVersion)({
      taskId: params.taskId,
      userId: user.id,
      outlineVersionId: body?.outlineVersionId?.trim() || undefined
    });

    // 2. Freeze quota NOW (right before writing starts), and claim single execution lock
    let reservation;
    try {
      reservation = await (
        dependencies.reserveQuotaForTask ?? reserveQuotaForTask
      )(params.taskId, user.id);
    } catch (reservationError) {
      console.error("[outline-approve] quota reservation failed:", {
        taskId: params.taskId,
        userId: user.id,
        error:
          reservationError instanceof Error
            ? reservationError.message
            : String(reservationError)
      });
      throw reservationError;
    }

    // 3. Process the task (writing pipeline) and settle quota only after success
    let processed;
    try {
      processed = await (dependencies.processTask ?? processApprovedTask)({
        taskId: params.taskId,
        userId: user.id,
        safetyIdentifier: buildSafetyIdentifier(user.id)
      });
      await (dependencies.settleQuotaForTask ?? settleQuotaForTask)(
        params.taskId,
        user.id,
        reservation
      );
    } catch (pipelineError) {
      if (pipelineError instanceof TaskProcessingStageError) {
        console.error(
          "[outline-approve] Writing pipeline failed at stage:",
          pipelineError.stage,
          pipelineError.message
        );
      } else {
        console.error(
          "[outline-approve] Writing pipeline failed:",
          pipelineError instanceof Error ? pipelineError.message : pipelineError
        );
      }

      await (dependencies.releaseQuotaForTask ?? releaseQuotaForTask)(
        params.taskId,
        user.id,
        reservation
      );
      await (dependencies.markTaskFailed ?? markTaskFailed)(params.taskId, user.id);

      throw pipelineError;
    }

    return NextResponse.json({
      ok: true,
      task: toSessionTaskPayload(processed.task),
      humanize: toSessionTaskHumanizePayload(processed.task),
      outlineVersion: processed.outlineVersion,
      downloads: processed.downloads,
      finalWordCount: countBodyWords(processed.finalDraftMarkdown),
      message: "大纲已确认，正文、核验和交付文件正在本次流程中完成。"
    });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json(
        {
          ok: false,
          message: "请先登录后再确认大纲。"
        },
        { status: 401 }
      );
    }

    if (
      error instanceof Error &&
      (error.message === "TASK_NOT_FOUND" || error.message === "OUTLINE_VERSION_NOT_FOUND")
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "没有找到你要确认的大纲版本。"
        },
        { status: 404 }
      );
    }

    if (error instanceof Error && error.message === "TASK_ALREADY_PROCESSING") {
      return NextResponse.json(
        {
          ok: false,
          message: "这份任务已经在处理中，请不要重复点击确认。"
        },
        { status: 409 }
      );
    }

    if (error instanceof Error && error.message === "TASK_REQUIREMENTS_NOT_READY") {
      return NextResponse.json(
        {
          ok: false,
          message: "任务要求还没准备好（字数或引用格式缺失），请先完成分析。"
        },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === "INSUFFICIENT_QUOTA") {
      return NextResponse.json(
        {
          ok: false,
          message: "当前积分不足，请先充值后再确认大纲。"
        },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === "REAL_PERSISTENCE_REQUIRED") {
      return NextResponse.json(
        {
          ok: false,
          message: "当前环境还没接入真实数据库，不能继续走正式写作流程。"
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "确认大纲失败"
      },
      { status: 500 }
    );
  }
}

/**
 * Freeze quota when outline is approved (right before writing starts).
 * Uses the task's current targetWordCount (which may have been updated during file analysis).
 */
async function reserveQuotaForTask(
  taskId: string,
  userId: string
): Promise<FrozenQuotaReservation> {
  if (!shouldUseSupabasePersistence()) {
    throw new Error("REAL_PERSISTENCE_REQUIRED");
  }

  return reserveQuotaForTaskWithSupabase(taskId, userId);
}

async function reserveQuotaForTaskWithSupabase(
  taskId: string,
  userId: string
): Promise<FrozenQuotaReservation> {
  const client = createSupabaseAdminClient();

  const { data: lockedTask, error: lockError } = await client
    .from("writing_tasks")
    .update({ status: "drafting" })
    .eq("id", taskId)
    .eq("user_id", userId)
    .eq("status", "awaiting_outline_approval")
    .select("id,target_word_count")
    .maybeSingle();

  if (lockError) {
    throw new Error(`锁定任务失败：${lockError.message}`);
  }

  if (!lockedTask) {
    const { data: taskExists, error: taskReadError } = await client
      .from("writing_tasks")
      .select("id,status")
      .eq("id", taskId)
      .eq("user_id", userId)
      .maybeSingle();

    if (taskReadError) {
      throw new Error(`读取任务失败：${taskReadError.message}`);
    }

    if (!taskExists) {
      throw new Error("TASK_NOT_FOUND");
    }

    throw new Error("TASK_ALREADY_PROCESSING");
  }

  if (typeof lockedTask.target_word_count !== "number") {
    await revertTaskToAwaitingOutlineApproval(taskId, userId);
    throw new Error("TASK_REQUIREMENTS_NOT_READY");
  }

  const quotaCost = resolveGenerationTaskQuotaCost(Number(lockedTask.target_word_count));
  let frozenResult: ReturnType<typeof freezeQuota> | null = null;
  let applied = false;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const wallet = await getUserWalletFromSupabase(userId);
    try {
      frozenResult = freezeQuota({
        wallet,
        amount: quotaCost,
        taskId,
        chargePath: "generation"
      });
    } catch {
      await revertTaskToAwaitingOutlineApproval(taskId, userId);
      throw new Error("INSUFFICIENT_QUOTA");
    }

    try {
      await applyWalletMutationWithLedgerInSupabase({
        userId,
        taskId,
        expectedWallet: wallet,
        nextWallet: frozenResult.wallet,
        entry: frozenResult.entry
      });
      applied = true;
      break;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === "WALLET_CONFLICT" || message === "WALLET_NEGATIVE_NOT_ALLOWED") {
        continue;
      }
      await revertTaskToAwaitingOutlineApproval(taskId, userId);
      throw error;
    }
  }

  if (!applied || !frozenResult) {
    await revertTaskToAwaitingOutlineApproval(taskId, userId);
    throw new Error("INSUFFICIENT_QUOTA");
  }

  const { error: reservationError } = await client
    .from("writing_tasks")
    .update({ quota_reservation: frozenResult.reservation })
    .eq("id", taskId)
    .eq("user_id", userId);

  if (reservationError) {
    await releaseQuotaForTaskWithSupabase(taskId, userId, frozenResult.reservation, {
      clearReservation: false
    });
    await revertTaskToAwaitingOutlineApproval(taskId, userId);
    throw new Error(`写入冻结积分凭证失败：${reservationError.message}`);
  }

  return frozenResult.reservation;
}

/**
 * Settle frozen quota after the full writing pipeline succeeds.
 */
async function settleQuotaForTask(
  taskId: string,
  userId: string,
  reservation: FrozenQuotaReservation
) {
  if (!shouldUseSupabasePersistence()) {
    throw new Error("REAL_PERSISTENCE_REQUIRED");
  }

  let settled = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const wallet = await getUserWalletFromSupabase(userId);
    const next = settleQuota({ wallet, reservation });

    try {
      await applyWalletMutationWithLedgerInSupabase({
        userId,
        taskId,
        expectedWallet: wallet,
        nextWallet: next.wallet,
        entry: next.entry
      });
      settled = true;
      break;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === "WALLET_CONFLICT" || message === "WALLET_NEGATIVE_NOT_ALLOWED") {
        continue;
      }
      throw error;
    }
  }

  if (!settled) {
    throw new Error("SETTLE_WALLET_CONFLICT");
  }

  const client = createSupabaseAdminClient();
  const { error } = await client
    .from("writing_tasks")
    .update({ quota_reservation: null })
    .eq("id", taskId)
    .eq("user_id", userId);

  if (error) {
    console.warn(
      "[outline-approve] quota settled but reservation cleanup failed:",
      error.message
    );
  }
}

/**
 * Release frozen quota when writing fails at any stage.
 */
async function releaseQuotaForTask(
  taskId: string,
  userId: string,
  reservation: FrozenQuotaReservation
) {
  if (!shouldUseSupabasePersistence()) {
    throw new Error("REAL_PERSISTENCE_REQUIRED");
  }

  await releaseQuotaForTaskWithSupabase(taskId, userId, reservation, {
    clearReservation: true
  });
}

async function releaseQuotaForTaskWithSupabase(
  taskId: string,
  userId: string,
  reservation: FrozenQuotaReservation,
  options: {
    clearReservation: boolean;
  }
) {
  let released = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const wallet = await getUserWalletFromSupabase(userId);
    const next = releaseQuota({ wallet, reservation });

    try {
      await applyWalletMutationWithLedgerInSupabase({
        userId,
        taskId,
        expectedWallet: wallet,
        nextWallet: next.wallet,
        entry: next.entry
      });
      released = true;
      break;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === "WALLET_CONFLICT" || message === "WALLET_NEGATIVE_NOT_ALLOWED") {
        continue;
      }
      throw error;
    }
  }

  if (!released) {
    throw new Error("RELEASE_WALLET_CONFLICT");
  }

  if (options.clearReservation) {
    const client = createSupabaseAdminClient();
    const { error } = await client
      .from("writing_tasks")
      .update({ quota_reservation: null })
      .eq("id", taskId)
      .eq("user_id", userId);

    if (error) {
      console.warn(
        "[outline-approve] quota released but reservation cleanup failed:",
        error.message
      );
    }
  }
}

async function markTaskFailed(taskId: string, userId: string) {
  if (!shouldUseSupabasePersistence()) {
    throw new Error("REAL_PERSISTENCE_REQUIRED");
  }

  await setOwnedTaskStatusInSupabase(taskId, userId, "failed");
  const client = createSupabaseAdminClient();
  const { error } = await client
    .from("writing_tasks")
    .update({ quota_reservation: null })
    .eq("id", taskId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`更新任务失败状态失败：${error.message}`);
  }
}

async function revertTaskToAwaitingOutlineApproval(taskId: string, userId: string) {
  const client = createSupabaseAdminClient();
  const { error } = await client
    .from("writing_tasks")
    .update({
      status: "awaiting_outline_approval"
    })
    .eq("id", taskId)
    .eq("user_id", userId)
    .eq("status", "drafting");

  if (error) {
    console.warn(
      "[outline-approve] failed to revert task status after reservation error:",
      error.message
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { taskId } = await context.params;
  return handleOutlineApprovalRequest(request, { taskId });
}

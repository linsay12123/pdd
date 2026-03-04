import { NextResponse } from "next/server";
import { requireCurrentSessionUser } from "@/src/lib/auth/current-user";
import { buildSafetyIdentifier } from "@/src/lib/ai/safety-identifier";
import { chargeQuota } from "@/src/lib/billing/charge-quota";
import { refundChargedQuota } from "@/src/lib/billing/refund-charged-quota";
import { countBodyWords } from "@/src/lib/drafts/word-count";
import {
  appendPaymentLedgerEntry,
  getUserWallet,
  setUserWallet
} from "@/src/lib/payments/repository";
import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import {
  processApprovedTask,
  TaskProcessingStageError
} from "@/src/lib/tasks/process-approved-task";
import {
  getTaskSummary,
  patchTaskSummary,
  updateTaskStatus
} from "@/src/lib/tasks/repository";
import { approveOutlineVersion } from "@/src/lib/tasks/save-outline-version";
import { toSessionTaskPayload } from "@/src/lib/tasks/session-task";
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

    // 1. Approve the outline
    await approveOutlineVersion({
      taskId: params.taskId,
      userId: user.id,
      outlineVersionId: body?.outlineVersionId?.trim() || undefined
    });

    // 2. Charge quota NOW (right before writing starts)
    const reservation = await chargeQuotaForTask(params.taskId, user.id);

    // 3. Process the task (writing pipeline) — refund quota only for early-stage failures
    let processed;
    try {
      processed = await (dependencies.processTask ?? processApprovedTask)({
        taskId: params.taskId,
        userId: user.id,
        safetyIdentifier: buildSafetyIdentifier(user.id)
      });
    } catch (writingError) {
      const shouldRefund =
        writingError instanceof TaskProcessingStageError &&
        (writingError.stage === "drafting" ||
          writingError.stage === "adjusting_word_count");

      console.error(
        "[outline-approve] Writing pipeline failed:",
        writingError instanceof Error ? writingError.message : writingError
      );

      if (shouldRefund) {
        await refundQuotaForTask(params.taskId, user.id, reservation);
        await markTaskFailed(params.taskId, user.id);
      }

      throw writingError;
    }

    return NextResponse.json({
      ok: true,
      task: toSessionTaskPayload(processed.task),
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

    if (error instanceof Error && error.message === "INSUFFICIENT_QUOTA") {
      return NextResponse.json(
        {
          ok: false,
          message: "当前积分不足，请先充值后再确认大纲。"
        },
        { status: 400 }
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
 * Charge quota when outline is approved (right before writing starts).
 * Uses the task's current targetWordCount (which may have been updated during file analysis).
 */
async function chargeQuotaForTask(
  taskId: string,
  userId: string
): Promise<FrozenQuotaReservation> {
  if (!shouldUseSupabasePersistence()) {
    return chargeQuotaForTaskLocally(taskId, userId);
  }

  return chargeQuotaForTaskWithSupabase(taskId, userId);
}

function chargeQuotaForTaskLocally(
  taskId: string,
  userId: string
): FrozenQuotaReservation {
  const task = getTaskSummary(taskId);

  if (!task || task.userId !== userId) {
    throw new Error("TASK_NOT_FOUND");
  }

  if (typeof task.targetWordCount !== "number") {
    throw new Error("TASK_REQUIREMENTS_NOT_READY");
  }

  const quotaCost = resolveGenerationTaskQuotaCost(task.targetWordCount);
  const wallet = getUserWallet(userId);
  let charged;

  try {
    charged = chargeQuota({
      wallet,
      amount: quotaCost,
      taskId,
      chargePath: "generation"
    });
  } catch {
    throw new Error("INSUFFICIENT_QUOTA");
  }

  setUserWallet(userId, charged.wallet);
  appendPaymentLedgerEntry(userId, charged.entry);
  patchTaskSummary(taskId, {
    quotaReservation: charged.reservation
  });

  return charged.reservation;
}

async function chargeQuotaForTaskWithSupabase(
  taskId: string,
  userId: string
): Promise<FrozenQuotaReservation> {
  const client = createSupabaseAdminClient();

  // Read current task to get targetWordCount
  const { data: taskRow, error: taskError } = await client
    .from("writing_tasks")
    .select("id,target_word_count")
    .eq("id", taskId)
    .eq("user_id", userId)
    .maybeSingle();

  if (taskError || !taskRow) {
    throw new Error("TASK_NOT_FOUND");
  }

  if (typeof taskRow.target_word_count !== "number") {
    throw new Error("TASK_REQUIREMENTS_NOT_READY");
  }

  const quotaCost = resolveGenerationTaskQuotaCost(Number(taskRow.target_word_count));

  // Read wallet
  const { data: walletRow, error: walletError } = await client
    .from("quota_wallets")
    .select("recharge_quota,subscription_quota,frozen_quota")
    .eq("user_id", userId)
    .maybeSingle();

  if (walletError) {
    throw new Error(`读取积分余额失败：${walletError.message}`);
  }

  const wallet = {
    rechargeQuota: Number(walletRow?.recharge_quota ?? 0),
    subscriptionQuota: Number(walletRow?.subscription_quota ?? 0),
    frozenQuota: Number(walletRow?.frozen_quota ?? 0)
  };

  let charged;

  try {
    charged = chargeQuota({
      wallet,
      amount: quotaCost,
      taskId,
      chargePath: "generation"
    });
  } catch {
    throw new Error("INSUFFICIENT_QUOTA");
  }

  // Update wallet
  const { error: walletUpdateError } = await client
    .from("quota_wallets")
    .update({
      recharge_quota: charged.wallet.rechargeQuota,
      subscription_quota: charged.wallet.subscriptionQuota,
      frozen_quota: charged.wallet.frozenQuota
    })
    .eq("user_id", userId);

  if (walletUpdateError) {
    throw new Error(`扣除积分失败：${walletUpdateError.message}`);
  }

  // Write ledger entry
  const { error: ledgerError } = await client
    .from("quota_ledger_entries")
    .insert({
      user_id: userId,
      task_id: taskId,
      entry_kind: charged.entry.kind,
      amount: charged.entry.amount,
      balance_recharge_after: charged.wallet.rechargeQuota,
      balance_subscription_after: charged.wallet.subscriptionQuota,
      balance_frozen_after: charged.wallet.frozenQuota,
      unique_event_key: charged.entry.ledgerKey,
      metadata: {
        note: charged.entry.note
      }
    });

  if (ledgerError) {
    // Rollback wallet update
    await client
      .from("quota_wallets")
      .update({
        recharge_quota: wallet.rechargeQuota,
        subscription_quota: wallet.subscriptionQuota,
        frozen_quota: wallet.frozenQuota
      })
      .eq("user_id", userId);
    throw new Error(`写入积分流水失败：${ledgerError.message}`);
  }

  // Store reservation on task for later refund if needed
  await client
    .from("writing_tasks")
    .update({ quota_reservation: charged.reservation })
    .eq("id", taskId)
    .eq("user_id", userId);

  return charged.reservation;
}

/**
 * Refund charged quota when early-stage writing fails after outline approval.
 */
async function refundQuotaForTask(
  taskId: string,
  userId: string,
  reservation: FrozenQuotaReservation
) {
  try {
    if (!shouldUseSupabasePersistence()) {
      const wallet = getUserWallet(userId);
      const refunded = refundChargedQuota({ wallet, reservation });
      setUserWallet(userId, refunded.wallet);
      appendPaymentLedgerEntry(userId, refunded.entry);
      patchTaskSummary(taskId, {
        quotaReservation: undefined
      });
      return;
    }

    const client = createSupabaseAdminClient();
    const { data: walletRow } = await client
      .from("quota_wallets")
      .select("recharge_quota,subscription_quota,frozen_quota")
      .eq("user_id", userId)
      .maybeSingle();

    const wallet = {
      rechargeQuota: Number(walletRow?.recharge_quota ?? 0),
      subscriptionQuota: Number(walletRow?.subscription_quota ?? 0),
      frozenQuota: Number(walletRow?.frozen_quota ?? 0)
    };

    const refunded = refundChargedQuota({ wallet, reservation });

    await client
      .from("quota_wallets")
      .update({
        recharge_quota: refunded.wallet.rechargeQuota,
        subscription_quota: refunded.wallet.subscriptionQuota,
        frozen_quota: refunded.wallet.frozenQuota
      })
      .eq("user_id", userId);

    await client.from("quota_ledger_entries").insert({
      user_id: userId,
      task_id: taskId,
      entry_kind: refunded.entry.kind,
      amount: refunded.entry.amount,
      balance_recharge_after: refunded.wallet.rechargeQuota,
      balance_subscription_after: refunded.wallet.subscriptionQuota,
      balance_frozen_after: refunded.wallet.frozenQuota,
      unique_event_key: refunded.entry.ledgerKey,
      metadata: {
        note: refunded.entry.note
      }
    });

    await client
      .from("writing_tasks")
      .update({ quota_reservation: null })
      .eq("id", taskId)
      .eq("user_id", userId);
  } catch (releaseError) {
    console.error(
      "[outline-approve] Failed to refund quota after writing failure:",
      releaseError instanceof Error ? releaseError.message : releaseError
    );
  }
}

async function markTaskFailed(taskId: string, userId: string) {
  if (!shouldUseSupabasePersistence()) {
    updateTaskStatus(taskId, "failed");
    patchTaskSummary(taskId, {
      quotaReservation: undefined
    });
    return;
  }

  const client = createSupabaseAdminClient();
  await client
    .from("writing_tasks")
    .update({
      status: "failed",
      quota_reservation: null
    })
    .eq("id", taskId)
    .eq("user_id", userId);
}

export async function POST(request: Request, context: RouteContext) {
  const { taskId } = await context.params;
  return handleOutlineApprovalRequest(request, { taskId });
}

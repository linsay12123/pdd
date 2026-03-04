import { NextResponse } from "next/server";
import { requireCurrentSessionUser } from "@/src/lib/auth/current-user";
import { buildSafetyIdentifier } from "@/src/lib/ai/safety-identifier";
import { freezeQuota } from "@/src/lib/billing/freeze-quota";
import { releaseQuota } from "@/src/lib/billing/release-quota";
import { countBodyWords } from "@/src/lib/drafts/word-count";
import {
  appendPaymentLedgerEntry,
  getUserWallet,
  setUserWallet
} from "@/src/lib/payments/repository";
import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { processApprovedTask } from "@/src/lib/tasks/process-approved-task";
import { getTaskSummary } from "@/src/lib/tasks/repository";
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

    // 2. Freeze quota NOW (right before writing starts)
    const reservation = await freezeQuotaForTask(params.taskId, user.id);

    // 3. Process the task (writing pipeline) — release quota on failure
    let processed;
    try {
      processed = await (dependencies.processTask ?? processApprovedTask)({
        taskId: params.taskId,
        userId: user.id,
        safetyIdentifier: buildSafetyIdentifier(user.id)
      });
    } catch (writingError) {
      // Writing failed — release frozen quota back to the user
      console.error(
        "[outline-approve] Writing pipeline failed, releasing quota:",
        writingError instanceof Error ? writingError.message : writingError
      );
      await releaseQuotaForTask(params.taskId, user.id, reservation);
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
 * Freeze quota when outline is approved (right before writing starts).
 * Uses the task's current targetWordCount (which may have been updated during file analysis).
 */
async function freezeQuotaForTask(
  taskId: string,
  userId: string
): Promise<FrozenQuotaReservation> {
  if (!shouldUseSupabasePersistence()) {
    return freezeQuotaForTaskLocally(taskId, userId);
  }

  return freezeQuotaForTaskWithSupabase(taskId, userId);
}

function freezeQuotaForTaskLocally(
  taskId: string,
  userId: string
): FrozenQuotaReservation {
  const task = getTaskSummary(taskId);

  if (!task || task.userId !== userId) {
    throw new Error("TASK_NOT_FOUND");
  }

  const quotaCost = resolveGenerationTaskQuotaCost(task.targetWordCount);
  const wallet = getUserWallet(userId);
  let frozen;

  try {
    frozen = freezeQuota({
      wallet,
      amount: quotaCost,
      taskId,
      chargePath: "generation"
    });
  } catch {
    throw new Error("INSUFFICIENT_QUOTA");
  }

  setUserWallet(userId, frozen.wallet);
  appendPaymentLedgerEntry(userId, frozen.entry);

  return frozen.reservation;
}

async function freezeQuotaForTaskWithSupabase(
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

  let frozen;

  try {
    frozen = freezeQuota({
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
      recharge_quota: frozen.wallet.rechargeQuota,
      subscription_quota: frozen.wallet.subscriptionQuota,
      frozen_quota: frozen.wallet.frozenQuota
    })
    .eq("user_id", userId);

  if (walletUpdateError) {
    throw new Error(`冻结积分失败：${walletUpdateError.message}`);
  }

  // Write ledger entry
  const { error: ledgerError } = await client
    .from("quota_ledger_entries")
    .insert({
      user_id: userId,
      task_id: taskId,
      entry_kind: frozen.entry.kind,
      amount: frozen.entry.amount,
      balance_recharge_after: frozen.wallet.rechargeQuota,
      balance_subscription_after: frozen.wallet.subscriptionQuota,
      balance_frozen_after: frozen.wallet.frozenQuota,
      unique_event_key: frozen.entry.ledgerKey,
      metadata: {
        note: frozen.entry.note
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

  // Store reservation on task for later release if needed
  await client
    .from("writing_tasks")
    .update({ quota_reservation: frozen.reservation })
    .eq("id", taskId)
    .eq("user_id", userId);

  return frozen.reservation;
}

/**
 * Release quota when writing fails after outline approval.
 */
async function releaseQuotaForTask(
  taskId: string,
  userId: string,
  reservation: FrozenQuotaReservation
) {
  try {
    if (!shouldUseSupabasePersistence()) {
      const wallet = getUserWallet(userId);
      const released = releaseQuota({ wallet, reservation });
      setUserWallet(userId, released.wallet);
      appendPaymentLedgerEntry(userId, released.entry);
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

    const released = releaseQuota({ wallet, reservation });

    await client
      .from("quota_wallets")
      .update({
        recharge_quota: released.wallet.rechargeQuota,
        subscription_quota: released.wallet.subscriptionQuota,
        frozen_quota: released.wallet.frozenQuota
      })
      .eq("user_id", userId);

    await client.from("quota_ledger_entries").insert({
      user_id: userId,
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
  } catch (releaseError) {
    console.error(
      "[outline-approve] Failed to release quota after writing failure:",
      releaseError instanceof Error ? releaseError.message : releaseError
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { taskId } = await context.params;
  return handleOutlineApprovalRequest(request, { taskId });
}

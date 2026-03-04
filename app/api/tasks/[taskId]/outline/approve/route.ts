import { NextResponse } from "next/server";
import { requireCurrentSessionUser } from "@/src/lib/auth/current-user";
import { buildSafetyIdentifier } from "@/src/lib/ai/safety-identifier";
import { chargeQuota } from "@/src/lib/billing/charge-quota";
import { refundChargedQuota } from "@/src/lib/billing/refund-charged-quota";
import { countBodyWords } from "@/src/lib/drafts/word-count";
import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import {
  appendPaymentLedgerEntryToSupabase,
  getUserWalletFromSupabase,
  setUserWalletInSupabase
} from "@/src/lib/payments/supabase-wallet";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import {
  processApprovedTask,
  TaskProcessingStageError
} from "@/src/lib/tasks/process-approved-task";
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
  isPersistenceReady?: () => boolean;
  approveOutline?: typeof approveOutlineVersion;
  chargeQuotaForTask?: (
    taskId: string,
    userId: string
  ) => Promise<FrozenQuotaReservation>;
  refundQuotaForTask?: (
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

    // 2. Charge quota NOW (right before writing starts)
    const reservation = await (dependencies.chargeQuotaForTask ?? chargeQuotaForTask)(
      params.taskId,
      user.id
    );

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
        await (dependencies.refundQuotaForTask ?? refundQuotaForTask)(
          params.taskId,
          user.id,
          reservation
        );
        await (dependencies.markTaskFailed ?? markTaskFailed)(params.taskId, user.id);
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
 * Charge quota when outline is approved (right before writing starts).
 * Uses the task's current targetWordCount (which may have been updated during file analysis).
 */
async function chargeQuotaForTask(
  taskId: string,
  userId: string
): Promise<FrozenQuotaReservation> {
  if (!shouldUseSupabasePersistence()) {
    throw new Error("REAL_PERSISTENCE_REQUIRED");
  }

  return chargeQuotaForTaskWithSupabase(taskId, userId);
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

  const wallet = await getUserWalletFromSupabase(userId);

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
  await setUserWalletInSupabase(userId, charged.wallet);

  // Write ledger entry
  await appendPaymentLedgerEntryToSupabase({
    userId,
    taskId,
    entry: charged.entry,
    walletAfter: charged.wallet
  });

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
      throw new Error("REAL_PERSISTENCE_REQUIRED");
    }

    const client = createSupabaseAdminClient();
    const wallet = await getUserWalletFromSupabase(userId);

    const refunded = refundChargedQuota({ wallet, reservation });

    await setUserWalletInSupabase(userId, refunded.wallet);
    await appendPaymentLedgerEntryToSupabase({
      userId,
      taskId,
      entry: refunded.entry,
      walletAfter: refunded.wallet
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
    throw new Error("REAL_PERSISTENCE_REQUIRED");
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

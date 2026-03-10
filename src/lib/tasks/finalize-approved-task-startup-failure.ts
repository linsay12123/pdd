import "server-only";

import { releaseQuota } from "@/src/lib/billing/release-quota";
import { appendPaymentLedgerEntry, getUserWallet, setUserWallet } from "@/src/lib/payments/repository";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { shouldUseLocalTestPersistence, shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import { getTaskSummary, saveTaskSummary } from "@/src/lib/tasks/repository";
import type { FrozenQuotaReservation } from "@/src/types/billing";
import type { TaskStatus, TaskSummary, TaskWorkflowStage } from "@/src/types/tasks";

type FinalizeMode = "revert" | "fail";

export type FinalizeApprovedTaskStartupFailureInput = {
  taskId: string;
  userId: string;
  expectedApprovalAttemptCount: number;
  mode: FinalizeMode;
  previousStatus?: TaskStatus;
  previousLastWorkflowStage?: TaskWorkflowStage | null;
  previousWorkflowStageTimestamps?: Record<string, string>;
  previousWorkflowErrorMessage?: string | null;
  failureMessage?: string | null;
};

export async function finalizeApprovedTaskStartupFailure(
  input: FinalizeApprovedTaskStartupFailureInput
) {
  if (shouldUseSupabasePersistence()) {
    return finalizeApprovedTaskStartupFailureWithSupabase(input);
  }

  if (shouldUseLocalTestPersistence()) {
    return finalizeApprovedTaskStartupFailureLocally(input);
  }

  return {
    applied: false,
    released: false,
    status: null
  } as const;
}

async function finalizeApprovedTaskStartupFailureWithSupabase(
  input: FinalizeApprovedTaskStartupFailureInput
) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client.rpc("finalize_approved_task_startup_failure", {
    p_task_id: input.taskId,
    p_user_id: input.userId,
    p_expected_approval_attempt_count: input.expectedApprovalAttemptCount,
    p_mode: input.mode,
    p_previous_status: input.previousStatus ?? null,
    p_previous_last_workflow_stage: input.previousLastWorkflowStage ?? null,
    p_previous_workflow_stage_timestamps: input.previousWorkflowStageTimestamps ?? {},
    p_previous_workflow_error_message: input.previousWorkflowErrorMessage ?? null,
    p_failure_message: input.failureMessage ?? null
  });

  if (error) {
    throw new Error(`收口正文启动失败状态失败：${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : null;
  return {
    applied: row?.applied === true,
    released: row?.released === true,
    status: typeof row?.status === "string" ? row.status : null
  } as const;
}

async function finalizeApprovedTaskStartupFailureLocally(
  input: FinalizeApprovedTaskStartupFailureInput
) {
  const task = getTaskSummary(input.taskId);

  if (!task || task.userId !== input.userId) {
    return {
      applied: false,
      released: false,
      status: null
    } as const;
  }

  if ((task.approvalAttemptCount ?? 0) !== input.expectedApprovalAttemptCount) {
    return {
      applied: false,
      released: false,
      status: task.status
    } as const;
  }

  let released = false;
  const reservation = task.quotaReservation;
  if (reservation) {
    released = releaseReservationLocally(input.userId, reservation);
  }

  const nextTask: TaskSummary =
    input.mode === "revert"
      ? {
          ...task,
          status: input.previousStatus ?? "awaiting_outline_approval",
          lastWorkflowStage: input.previousLastWorkflowStage ?? null,
          workflowStageTimestamps: input.previousWorkflowStageTimestamps ?? {},
          workflowErrorMessage: input.previousWorkflowErrorMessage ?? null,
          quotaReservation: undefined
        }
      : {
          ...task,
          status: "failed",
          lastWorkflowStage: task.lastWorkflowStage ?? "drafting",
          workflowStageTimestamps: {
            ...(task.workflowStageTimestamps ?? {}),
            failed: new Date().toISOString()
          },
          workflowErrorMessage: input.failureMessage ?? null,
          quotaReservation: undefined
        };

  saveTaskSummary(nextTask);

  return {
    applied: true,
    released,
    status: nextTask.status
  } as const;
}

function releaseReservationLocally(userId: string, reservation: FrozenQuotaReservation) {
  const wallet = getUserWallet(userId);
  const released = releaseQuota({ wallet, reservation });
  setUserWallet(userId, released.wallet);
  appendPaymentLedgerEntry(userId, released.entry);
  return true;
}

import { deleteTaskArtifact } from "@/src/lib/storage/task-artifacts";
import { releaseQuota } from "@/src/lib/billing/release-quota";
import { settleQuota } from "@/src/lib/billing/settle-quota";
import {
  applyWalletMutationWithLedgerInSupabase,
  getUserWalletFromSupabase
} from "@/src/lib/payments/supabase-wallet";
import {
  deleteOwnedTaskOutput,
} from "@/src/lib/tasks/task-output-store";
import {
  processApprovedTask,
  TaskProcessingStageError
} from "@/src/lib/tasks/process-approved-task";
import {
  getOwnedTaskFromSupabase,
  setOwnedTaskQuotaReservationInSupabase,
  setOwnedTaskStatusInSupabase
} from "@/src/lib/tasks/supabase-task-records";
import type { FrozenQuotaReservation } from "@/src/types/billing";
import type { TaskSummary, TaskWorkflowStage } from "@/src/types/tasks";

type RunApprovedTaskPipelineInput = {
  taskId: string;
  userId: string;
  safetyIdentifier?: string;
  approvalAttemptCount?: number;
};

type GeneratedOutputRecord = {
  id: string;
  userId: string;
  storagePath: string;
};

type RunApprovedTaskPipelineDependencies = {
  getOwnedTask?: (taskId: string, userId: string) => Promise<TaskSummary | null>;
  processApprovedTask?: typeof processApprovedTask;
  settleReservedQuotaForTask?: (
    taskId: string,
    userId: string,
    reservation: FrozenQuotaReservation
  ) => Promise<void>;
  releaseReservedQuotaForTask?: (
    taskId: string,
    userId: string,
    reservation: FrozenQuotaReservation
  ) => Promise<void>;
  setOwnedTaskStatusInSupabase?: typeof setOwnedTaskStatusInSupabase;
  setOwnedTaskQuotaReservationInSupabase?: typeof setOwnedTaskQuotaReservationInSupabase;
  rollbackGeneratedOutputs?: (outputs: GeneratedOutputRecord[]) => Promise<void>;
};

export async function runApprovedTaskPipeline(
  input: RunApprovedTaskPipelineInput,
  dependencies: RunApprovedTaskPipelineDependencies = {}
) {
  const getOwnedTask = dependencies.getOwnedTask ?? getOwnedTaskFromSupabase;
  const currentTask = await getOwnedTask(input.taskId, input.userId);

  if (!currentTask) {
    return {
      skipped: true as const,
      reason: "TASK_NOT_FOUND"
    };
  }

  if (
    typeof input.approvalAttemptCount === "number" &&
    (currentTask.approvalAttemptCount ?? 0) !== input.approvalAttemptCount
  ) {
    return {
      skipped: true as const,
      reason: "STALE_APPROVAL_ATTEMPT"
    };
  }

  if (!currentTask.quotaReservation) {
    return {
      skipped: true as const,
      reason: "TASK_QUOTA_RESERVATION_NOT_FOUND"
    };
  }

  const reservation = currentTask.quotaReservation;
  const processApprovedTaskImpl = dependencies.processApprovedTask ?? processApprovedTask;
  const settleReservedQuotaForTaskImpl =
    dependencies.settleReservedQuotaForTask ?? settleReservedQuotaForTask;
  const releaseReservedQuotaForTaskImpl =
    dependencies.releaseReservedQuotaForTask ?? releaseReservedQuotaForTask;
  const setOwnedTaskStatusInSupabaseImpl =
    dependencies.setOwnedTaskStatusInSupabase ?? setOwnedTaskStatusInSupabase;
  const setOwnedTaskQuotaReservationInSupabaseImpl =
    dependencies.setOwnedTaskQuotaReservationInSupabase ??
    setOwnedTaskQuotaReservationInSupabase;
  const rollbackGeneratedOutputsImpl =
    dependencies.rollbackGeneratedOutputs ?? rollbackGeneratedOutputs;

  let processed: Awaited<ReturnType<typeof processApprovedTask>> | null = null;

  try {
    processed = await processApprovedTaskImpl({
      taskId: input.taskId,
      userId: input.userId,
      safetyIdentifier: input.safetyIdentifier
    });

    await settleReservedQuotaForTaskImpl(input.taskId, input.userId, reservation);
    await setOwnedTaskQuotaReservationInSupabaseImpl(input.taskId, input.userId, null);
    const finalizedTask = await setOwnedTaskStatusInSupabaseImpl(
      input.taskId,
      input.userId,
      "deliverable_ready",
      {
        lastWorkflowStage: "exporting"
      }
    );

    return {
      ...processed,
      task: finalizedTask
    };
  } catch (error) {
    const lastWorkflowStage = resolveFailedWorkflowStage(
      processed?.task.lastWorkflowStage ?? null,
      error
    );

    if (processed?.generatedOutputs?.length) {
      try {
        await rollbackGeneratedOutputsImpl(processed.generatedOutputs);
      } catch (rollbackError) {
        console.error(
          "[approved-task-pipeline] failed to roll back generated outputs:",
          rollbackError instanceof Error ? rollbackError.message : rollbackError
        );
      }
    }

    try {
      await releaseReservedQuotaForTaskImpl(input.taskId, input.userId, reservation);
      await setOwnedTaskQuotaReservationInSupabaseImpl(input.taskId, input.userId, null);
    } catch (releaseError) {
      console.error(
        "[approved-task-pipeline] failed to release quota after pipeline error:",
        releaseError instanceof Error ? releaseError.message : releaseError
      );
    }

    try {
      await setOwnedTaskStatusInSupabaseImpl(input.taskId, input.userId, "failed", {
        lastWorkflowStage
      });
    } catch (markError) {
      console.error(
        "[approved-task-pipeline] failed to mark task as failed:",
        markError instanceof Error ? markError.message : markError
      );
    }

    throw error;
  }
}

function resolveFailedWorkflowStage(
  knownStage: TaskWorkflowStage | null,
  error: unknown
): TaskWorkflowStage {
  if (knownStage) {
    return knownStage;
  }

  if (error instanceof TaskProcessingStageError) {
    return error.stage;
  }

  return "drafting";
}

async function settleReservedQuotaForTask(
  taskId: string,
  userId: string,
  reservation: FrozenQuotaReservation
) {
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
}

async function releaseReservedQuotaForTask(
  taskId: string,
  userId: string,
  reservation: FrozenQuotaReservation
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
}

async function rollbackGeneratedOutputs(outputs: GeneratedOutputRecord[]) {
  for (const output of outputs) {
    await deleteTaskArtifact({
      storagePath: output.storagePath
    });
    await deleteOwnedTaskOutput({
      taskId: extractTaskIdFromStoragePath(output.storagePath),
      outputId: output.id,
      userId: output.userId
    });
  }
}

function extractTaskIdFromStoragePath(storagePath: string) {
  const segments = storagePath.split("/");
  const taskIndex = segments.findIndex((segment) => segment === "tasks");
  if (taskIndex >= 0 && segments[taskIndex + 1]) {
    return segments[taskIndex + 1];
  }

  throw new Error("TASK_OUTPUT_STORAGE_PATH_INVALID");
}

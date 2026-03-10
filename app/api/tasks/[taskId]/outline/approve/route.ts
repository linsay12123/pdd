import { NextResponse } from "next/server";
import { requireCurrentSessionUser } from "@/src/lib/auth/current-user";
import { buildSafetyIdentifier } from "@/src/lib/ai/safety-identifier";
import { freezeQuota } from "@/src/lib/billing/freeze-quota";
import { finalizeApprovedTaskStartupFailure } from "@/src/lib/tasks/finalize-approved-task-startup-failure";
import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import {
  applyWalletMutationWithLedgerInSupabase,
  getUserWalletFromSupabase
} from "@/src/lib/payments/supabase-wallet";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { approveOutlineVersion } from "@/src/lib/tasks/save-outline-version";
import {
  buildWorkflowMetadataSelect,
  buildWorkflowStageTimestamps,
  isWorkflowMetadataColumnMissingError,
  resolveWorkflowMetadataColumnAvailability,
  stripUnavailableWorkflowMetadata
} from "@/src/lib/tasks/workflow-stage-timestamps";
import {
  enqueueApprovedTaskRun,
  enqueueApprovedTaskStartupCheck
} from "@/src/lib/tasks/start-approved-task-run";
import {
  getTaskSummary,
  saveTaskSummary
} from "@/src/lib/tasks/repository";
import {
  toSessionTaskHumanizePayload,
  toSessionTaskPayload
} from "@/src/lib/tasks/session-task";
import { resolveGenerationTaskQuotaCost } from "@/src/lib/tasks/task-cost";
import type { SessionUser } from "@/src/types/auth";
import type { FrozenQuotaReservation } from "@/src/types/billing";
import type { TaskStatus, TaskWorkflowStage } from "@/src/types/tasks";

export const maxDuration = 300;

const workflowMetadataColumnsAvailable = {
  missingWorkflowStageTimestamps: false,
  missingWorkflowErrorMessage: false
} as const;

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
  ) => Promise<{
    reservation: FrozenQuotaReservation;
    approvalAttemptCount: number;
    workflowStageTimestamps?: {
      drafting?: string;
      adjusting_word_count?: string;
      verifying_references?: string;
      exporting?: string;
      deliverable_ready?: string;
      failed?: string;
    };
    previousStatus: TaskStatus;
    previousLastWorkflowStage: TaskWorkflowStage | null;
    previousWorkflowStageTimestamps?: Record<string, string>;
    previousWorkflowErrorMessage?: string | null;
  }>;
  finalizeStartupFailure?: typeof finalizeApprovedTaskStartupFailure;
  enqueueApprovedTaskRun?: (input: {
    taskId: string;
    userId: string;
    safetyIdentifier: string;
    approvalAttemptCount: number;
  }) => Promise<string | null>;
  enqueueApprovedTaskStartupCheck?: (input: {
    taskId: string;
    userId: string;
    approvalAttemptCount: number;
    triggerRunId: string;
  }) => Promise<string | null>;
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

    const approved = await (dependencies.approveOutline ?? approveOutlineVersion)({
      taskId: params.taskId,
      userId: user.id,
      outlineVersionId: body?.outlineVersionId?.trim() || undefined
    });

    let reservationResult: Awaited<
      ReturnType<NonNullable<OutlineApproveDependencies["reserveQuotaForTask"]>>
    >;
    try {
      reservationResult = await (
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

    try {
      const triggerRunId = await (
        dependencies.enqueueApprovedTaskRun ?? enqueueApprovedTaskRun
      )({
        taskId: params.taskId,
        userId: user.id,
        safetyIdentifier: buildSafetyIdentifier(user.id),
        approvalAttemptCount: reservationResult.approvalAttemptCount
      });

      if (!triggerRunId) {
        throw new Error("TRIGGER_RUN_ENQUEUE_FAILED");
      }

      const startupCheckRunId = await (
        dependencies.enqueueApprovedTaskStartupCheck ?? enqueueApprovedTaskStartupCheck
      )({
        taskId: params.taskId,
        userId: user.id,
        approvalAttemptCount: reservationResult.approvalAttemptCount,
        triggerRunId
      });

      if (!startupCheckRunId) {
        throw new Error("TRIGGER_STARTUP_CHECK_ENQUEUE_FAILED");
      }
    } catch (enqueueError) {
      await (
        dependencies.finalizeStartupFailure ?? finalizeApprovedTaskStartupFailure
      )({
        taskId: params.taskId,
        userId: user.id,
        expectedApprovalAttemptCount: reservationResult.approvalAttemptCount,
        mode: "revert",
        previousStatus: reservationResult.previousStatus,
        previousLastWorkflowStage: reservationResult.previousLastWorkflowStage,
        previousWorkflowErrorMessage: reservationResult.previousWorkflowErrorMessage,
        previousWorkflowStageTimestamps: reservationResult.previousWorkflowStageTimestamps
      });
      throw enqueueError;
    }

    return NextResponse.json(
      {
        ok: true,
        task: toSessionTaskPayload({
          ...approved.task,
          status: "drafting",
          workflowErrorMessage: null,
          lastWorkflowStage: "drafting",
          workflowStageTimestamps:
            reservationResult.workflowStageTimestamps ??
            buildWorkflowStageTimestamps({
              current: null,
              status: "drafting"
            })
        }),
        humanize: toSessionTaskHumanizePayload({
          ...approved.task,
          status: "drafting"
        }),
        outlineVersion: approved.outlineVersion,
        downloads: {
          finalDocxOutputId: null,
          referenceReportOutputId: null
        },
        finalWordCount: null,
        message: "大纲已确认，系统已进入正文写作阶段，页面会自动刷新后续进度。"
      },
      { status: 202 }
    );
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

async function reserveQuotaForTask(
  taskId: string,
  userId: string
): Promise<{
  reservation: FrozenQuotaReservation;
  approvalAttemptCount: number;
  workflowStageTimestamps: {
    drafting?: string;
    adjusting_word_count?: string;
    verifying_references?: string;
    exporting?: string;
    deliverable_ready?: string;
    failed?: string;
  };
  previousStatus: TaskStatus;
  previousLastWorkflowStage: TaskWorkflowStage | null;
  previousWorkflowStageTimestamps: Record<string, string>;
  previousWorkflowErrorMessage: string | null;
}> {
  if (!shouldUseSupabasePersistence()) {
    throw new Error("REAL_PERSISTENCE_REQUIRED");
  }

  return reserveQuotaForTaskWithSupabase(taskId, userId);
}

async function reserveQuotaForTaskWithSupabase(
  taskId: string,
  userId: string
): Promise<{
  reservation: FrozenQuotaReservation;
  approvalAttemptCount: number;
  workflowStageTimestamps: {
    drafting?: string;
    adjusting_word_count?: string;
    verifying_references?: string;
    exporting?: string;
    deliverable_ready?: string;
    failed?: string;
  };
  previousStatus: TaskStatus;
  previousLastWorkflowStage: TaskWorkflowStage | null;
  previousWorkflowStageTimestamps: Record<string, string>;
  previousWorkflowErrorMessage: string | null;
}> {
  const client = createSupabaseAdminClient();
  type CurrentTaskRow = {
    id: string;
    status: TaskStatus;
    target_word_count: number | null;
    approval_attempt_count: number | null;
    last_workflow_stage: string | null;
    workflow_stage_timestamps?: unknown;
    workflow_error_message?: string | null;
  };

  let currentTask: CurrentTaskRow | null = null;
  let currentTaskError: { message: string } | null = null;
  let workflowMetadataAvailability: ReturnType<
    typeof resolveWorkflowMetadataColumnAvailability
  > = workflowMetadataColumnsAvailable;
  {
    const result = await client
      .from("writing_tasks")
      .select(
        buildWorkflowMetadataSelect(
          "id,status,target_word_count,approval_attempt_count,last_workflow_stage",
          workflowMetadataAvailability
        )
      )
      .eq("id", taskId)
      .eq("user_id", userId)
      .maybeSingle();
    currentTask = result.data as CurrentTaskRow | null;
    currentTaskError = result.error;
  }

  if (currentTaskError && isWorkflowMetadataColumnMissingError(currentTaskError)) {
    workflowMetadataAvailability =
      resolveWorkflowMetadataColumnAvailability(currentTaskError);
    const legacyResult = await client
      .from("writing_tasks")
      .select(
        buildWorkflowMetadataSelect(
          "id,status,target_word_count,approval_attempt_count,last_workflow_stage",
          workflowMetadataAvailability
        )
      )
      .eq("id", taskId)
      .eq("user_id", userId)
      .maybeSingle();
    currentTask = legacyResult.data as CurrentTaskRow | null;
    currentTaskError = legacyResult.error;
  }

  if (currentTaskError) {
    throw new Error(`读取任务失败：${currentTaskError.message}`);
  }

  if (!currentTask) {
    throw new Error("TASK_NOT_FOUND");
  }

  const previousStatus = currentTask.status as TaskStatus;
  const previousLastWorkflowStage = currentTask.last_workflow_stage
    ? (String(currentTask.last_workflow_stage) as TaskWorkflowStage)
    : null;
  const previousWorkflowErrorMessage =
    typeof currentTask.workflow_error_message === "string"
      ? String(currentTask.workflow_error_message)
      : null;
  const previousWorkflowStageTimestamps = (
    currentTask.workflow_stage_timestamps &&
    typeof currentTask.workflow_stage_timestamps === "object"
      ? currentTask.workflow_stage_timestamps
      : {}
  ) as Record<string, string>;

  if (!["awaiting_outline_approval", "failed"].includes(previousStatus)) {
    throw new Error("TASK_ALREADY_PROCESSING");
  }

  const nextApprovalAttemptCount = Number(currentTask.approval_attempt_count ?? 0) + 1;
  const draftingRecordedAt = new Date().toISOString();
  const workflowStageTimestamps = buildWorkflowStageTimestamps({
    current: null,
    status: "drafting",
    recordedAt: draftingRecordedAt,
    reset: true
  });

  let { data: lockedTask, error: lockError } = await client
    .from("writing_tasks")
    .update({
      status: "drafting",
      last_workflow_stage: "drafting",
      workflow_error_message: null,
      approval_attempt_count: nextApprovalAttemptCount,
      workflow_stage_timestamps: workflowStageTimestamps
    })
    .eq("id", taskId)
    .eq("user_id", userId)
    .eq("status", previousStatus)
    .eq("approval_attempt_count", Number(currentTask.approval_attempt_count ?? 0))
    .select("id,target_word_count")
    .maybeSingle();

  if (lockError && isWorkflowMetadataColumnMissingError(lockError)) {
    const availability = resolveWorkflowMetadataColumnAvailability(lockError);
    const legacyResult = await client
      .from("writing_tasks")
      .update(
        stripUnavailableWorkflowMetadata(
          {
            status: "drafting",
            last_workflow_stage: "drafting",
            workflow_error_message: null,
            approval_attempt_count: nextApprovalAttemptCount,
            workflow_stage_timestamps: workflowStageTimestamps
          },
          availability
        )
      )
      .eq("id", taskId)
      .eq("user_id", userId)
      .eq("status", previousStatus)
      .eq("approval_attempt_count", Number(currentTask.approval_attempt_count ?? 0))
      .select("id,target_word_count")
      .maybeSingle();
    lockedTask = legacyResult.data;
    lockError = legacyResult.error;
  }

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
    await revertTaskToRetriableStatus(taskId, userId, {
      previousStatus,
      previousLastWorkflowStage,
      previousWorkflowErrorMessage
    });
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
      await revertTaskToRetriableStatus(taskId, userId, {
        previousStatus,
        previousLastWorkflowStage,
        previousWorkflowErrorMessage,
        previousWorkflowStageTimestamps
      });
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
      await revertTaskToRetriableStatus(taskId, userId, {
        previousStatus,
        previousLastWorkflowStage,
        previousWorkflowErrorMessage,
        previousWorkflowStageTimestamps
      });
      throw error;
    }
  }

  if (!applied || !frozenResult) {
    await revertTaskToRetriableStatus(taskId, userId, {
      previousStatus,
      previousLastWorkflowStage,
      previousWorkflowErrorMessage,
      previousWorkflowStageTimestamps
    });
    throw new Error("INSUFFICIENT_QUOTA");
  }

  const { error: reservationError } = await client
    .from("writing_tasks")
    .update({ quota_reservation: frozenResult.reservation })
    .eq("id", taskId)
    .eq("user_id", userId);

  if (reservationError) {
    await finalizeApprovedTaskStartupFailure({
      taskId,
      userId,
      expectedApprovalAttemptCount: nextApprovalAttemptCount,
      mode: "revert",
      previousStatus,
      previousLastWorkflowStage,
      previousWorkflowErrorMessage,
      previousWorkflowStageTimestamps
    });
    throw new Error(`写入冻结积分凭证失败：${reservationError.message}`);
  }

  return {
    reservation: frozenResult.reservation,
    approvalAttemptCount: nextApprovalAttemptCount,
    workflowStageTimestamps: workflowStageTimestamps ?? {},
    previousStatus,
    previousLastWorkflowStage,
    previousWorkflowErrorMessage,
    previousWorkflowStageTimestamps
  };
}

async function revertTaskToRetriableStatus(
  taskId: string,
  userId: string,
  input: {
    previousStatus: TaskStatus;
    previousLastWorkflowStage: TaskWorkflowStage | null;
    previousWorkflowStageTimestamps?: Record<string, string>;
    previousWorkflowErrorMessage?: string | null;
  }
) {
  if (!shouldUseSupabasePersistence()) {
    const task = getTaskSummary(taskId);
    if (task && task.userId === userId) {
      saveTaskSummary({
        ...task,
        status: input.previousStatus,
        lastWorkflowStage: input.previousLastWorkflowStage,
        workflowStageTimestamps: input.previousWorkflowStageTimestamps ?? {},
        workflowErrorMessage: input.previousWorkflowErrorMessage ?? null,
        quotaReservation: undefined
      });
    }
    return;
  }

  const client = createSupabaseAdminClient();
  let { error } = await client
    .from("writing_tasks")
    .update({
      status: input.previousStatus,
      last_workflow_stage: input.previousLastWorkflowStage,
      workflow_error_message: input.previousWorkflowErrorMessage ?? null,
      workflow_stage_timestamps: input.previousWorkflowStageTimestamps ?? {},
      quota_reservation: null
    })
    .eq("id", taskId)
    .eq("user_id", userId)
    .eq("status", "drafting");

  if (error && isWorkflowMetadataColumnMissingError(error)) {
    const availability = resolveWorkflowMetadataColumnAvailability(error);
    const legacyResult = await client
      .from("writing_tasks")
      .update(
        stripUnavailableWorkflowMetadata(
          {
            status: input.previousStatus,
            last_workflow_stage: input.previousLastWorkflowStage,
            workflow_error_message: input.previousWorkflowErrorMessage ?? null,
            workflow_stage_timestamps: input.previousWorkflowStageTimestamps ?? {},
            quota_reservation: null
          },
          availability
        )
      )
      .eq("id", taskId)
      .eq("user_id", userId)
      .eq("status", "drafting");
    error = legacyResult.error;
  }

  if (error) {
    console.warn(
      "[outline-approve] failed to revert task status after queue error:",
      error.message
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { taskId } = await context.params;
  return handleOutlineApprovalRequest(request, { taskId });
}

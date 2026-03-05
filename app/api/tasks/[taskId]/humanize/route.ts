import { NextResponse } from "next/server";
import { tasks } from "@trigger.dev/sdk/v3";
import { requireCurrentSessionUser } from "@/src/lib/auth/current-user";
import { freezeQuota } from "@/src/lib/billing/freeze-quota";
import { releaseQuota } from "@/src/lib/billing/release-quota";
import { quoteHumanizeTaskCost } from "@/src/lib/billing/quote-task-cost";
import { countBodyWords } from "@/src/lib/drafts/word-count";
import { defaultHumanizeProfile } from "@/src/lib/humanize/humanize-provider";
import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import {
  appendPaymentLedgerEntryToSupabase,
  getUserWalletFromSupabase,
  setUserWalletInSupabase
} from "@/src/lib/payments/supabase-wallet";
import {
  getLatestOwnedDraftFromSupabase,
  getOwnedTaskFromSupabase,
  updateOwnedTaskHumanizeStateInSupabase
} from "@/src/lib/tasks/supabase-task-records";
import { listOwnedTaskOutputs } from "@/src/lib/tasks/task-output-store";
import type { FrozenQuotaReservation } from "@/src/types/billing";
import type { SessionUser } from "@/src/types/auth";
import type { TaskHumanizeStatus, TaskSummary } from "@/src/types/tasks";

type RouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

type HumanizeTaskContext = {
  task: Pick<TaskSummary, "id" | "userId" | "status" | "humanizeStatus"> & {
    citationStyle: string;
  };
  draftMarkdown: string;
  bodyWordCount: number;
};

type HumanizeChargeResult = {
  amount: number;
  reservation: FrozenQuotaReservation;
};

type HumanizeStateSnapshot = {
  status: TaskHumanizeStatus;
  outputId: string | null;
  errorMessage: string | null;
  provider?: string | null;
  requestedAt?: string | null;
  completedAt?: string | null;
};

type HumanizedOutputCandidate = {
  id: string;
  outputKind: string;
  isActive: boolean;
  createdAt: string;
};

type HumanizeRouteDependencies = {
  requireUser?: () => Promise<SessionUser>;
  isPersistenceReady?: () => boolean;
  loadTaskContext?: (taskId: string, userId: string) => Promise<HumanizeTaskContext>;
  loadHumanizeStatus?: (taskId: string, userId: string) => Promise<HumanizeStateSnapshot>;
  loadHumanizeStatusForUser?: (taskId: string, userId: string) => Promise<HumanizeStateSnapshot>;
  chargeQuota?: (
    taskId: string,
    userId: string,
    bodyWordCount: number
  ) => Promise<HumanizeChargeResult>;
  releaseQuota?: (input: {
    taskId: string;
    userId: string;
    reservation: FrozenQuotaReservation;
  }) => Promise<void>;
  saveQueuedState?: (input: {
    taskId: string;
    userId: string;
  }) => Promise<void>;
  saveFailedState?: (input: {
    taskId: string;
    userId: string;
    message: string;
  }) => Promise<void>;
  enqueueHumanize?: (input: {
    taskId: string;
    userId: string;
    draftMarkdown: string;
    reservationSnapshot: FrozenQuotaReservation;
    citationStyle: string;
  }) => Promise<void>;
};

export function composeHumanizeDraftMarkdown(input: {
  draftBodyMarkdown: string;
  draftReferencesMarkdown?: string | null;
}) {
  const bodyMarkdown = input.draftBodyMarkdown.trim();
  const referencesMarkdown = input.draftReferencesMarkdown?.trim() ?? "";
  const hasReferencesHeading = /^##\s+references\s*$/im.test(bodyMarkdown);

  if (!referencesMarkdown || hasReferencesHeading) {
    return bodyMarkdown;
  }

  return `${bodyMarkdown}\n\n## References\n${referencesMarkdown}`;
}

export function pickPreferredHumanizedOutputId(
  outputs: HumanizedOutputCandidate[]
) {
  const humanizedOutputs = outputs.filter(
    (output) => output.outputKind === "humanized_docx"
  );

  if (humanizedOutputs.length === 0) {
    return null;
  }

  const sortedNewestFirst = [...humanizedOutputs].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
  const newestActive = sortedNewestFirst.find((output) => output.isActive);

  return newestActive?.id ?? sortedNewestFirst[0]?.id ?? null;
}

export async function handleHumanizeRequest(
  _request: Request,
  context: RouteContext,
  dependencies: HumanizeRouteDependencies = {}
) {
  const { taskId } = await context.params;

  let user: SessionUser;
  try {
    user = await (dependencies.requireUser ?? requireCurrentSessionUser)();
  } catch {
    return NextResponse.json(
      { ok: false, taskId, message: "请先登录后再使用降AI功能。" },
      { status: 401 }
    );
  }

  if (!process.env.UNDETECTABLE_API_KEY?.trim()) {
    return NextResponse.json(
      { ok: false, taskId, message: "Undetectable 降AI功能暂未启用，请先配置真实服务密钥。" },
      { status: 503 }
    );
  }

  if (!process.env.TRIGGER_SECRET_KEY?.trim()) {
    return NextResponse.json(
      { ok: false, taskId, message: "后台任务密钥还没配置好，暂时不能启动自动降AI。" },
      { status: 503 }
    );
  }

  if (!(dependencies.isPersistenceReady ?? shouldUseSupabasePersistence)()) {
    return NextResponse.json(
      { ok: false, taskId, message: "当前环境还没接入真实数据库，不能继续走正式降AI流程。" },
      { status: 503 }
    );
  }

  try {
    const taskContext = await (dependencies.loadTaskContext ?? loadTaskContextWithSupabase)(
      taskId,
      user.id
    );
    const currentState = await (dependencies.loadHumanizeStatus ?? loadHumanizeStateWithSupabase)(
      taskId,
      user.id
    );

    if (currentState.status === "queued" || currentState.status === "processing" || currentState.status === "retrying") {
      return NextResponse.json(
        {
          ok: true,
          taskId,
          humanizeStatus: currentState.status,
          downloads: {
            humanizedDocxOutputId: currentState.outputId
          },
          message: "降AI任务还在处理中，请稍后刷新。"
        },
        { status: 200 }
      );
    }

    if (currentState.status === "completed" && currentState.outputId) {
      return NextResponse.json(
        {
          ok: true,
          taskId,
          humanizeStatus: currentState.status,
          downloads: {
            humanizedDocxOutputId: currentState.outputId
          },
          message: "降AI后版本已经准备好，可以直接下载。"
        },
        { status: 200 }
      );
    }

    const charged = await (dependencies.chargeQuota ?? chargeHumanizeQuotaWithSupabase)(
      taskId,
      user.id,
      taskContext.bodyWordCount
    );

    await (dependencies.saveQueuedState ?? saveQueuedHumanizeStateWithSupabase)({
      taskId,
      userId: user.id
    });

    try {
      await (dependencies.enqueueHumanize ?? enqueueHumanizeWithTrigger)({
        taskId,
        userId: user.id,
        draftMarkdown: taskContext.draftMarkdown,
        reservationSnapshot: charged.reservation,
        citationStyle: taskContext.task.citationStyle
      });
    } catch (error) {
      await (dependencies.releaseQuota ?? releaseQueuedHumanizeQuotaWithSupabase)({
        taskId,
        userId: user.id,
        reservation: charged.reservation
      });
      await (dependencies.saveFailedState ?? saveFailedHumanizeStateWithSupabase)({
        taskId,
        userId: user.id,
        message: error instanceof Error ? error.message : "降AI任务提交失败，请稍后再试。"
      });
      throw error;
    }

    return NextResponse.json(
      {
        ok: true,
        taskId,
        humanizeStatus: "queued",
        downloads: {
          humanizedDocxOutputId: null
        },
        message: "降AI任务已经提交，系统正在后台处理中。"
      },
      { status: 202 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "TASK_NOT_FOUND") {
      return NextResponse.json(
        { ok: false, taskId, message: "未找到这个任务。" },
        { status: 404 }
      );
    }

    if (error instanceof Error && error.message === "DRAFT_NOT_FOUND") {
      return NextResponse.json(
        { ok: false, taskId, message: "找不到已生成的正文，请先完成文章生成。" },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === "TASK_CITATION_STYLE_NOT_READY") {
      return NextResponse.json(
        { ok: false, taskId, message: "任务的引用格式还没准备好，暂时不能继续降AI。" },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === "INSUFFICIENT_QUOTA") {
      return NextResponse.json(
        { ok: false, taskId, message: "积分不足，请充值后再试。" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        taskId,
        message: error instanceof Error ? error.message : "降AI处理失败，请稍后再试。"
      },
      { status: 500 }
    );
  }
}

export async function handleHumanizeStatusRequest(
  _request: Request,
  context: RouteContext,
  dependencies: HumanizeRouteDependencies = {}
) {
  const { taskId } = await context.params;

  let user: SessionUser;
  try {
    user = await (dependencies.requireUser ?? requireCurrentSessionUser)();
  } catch {
    return NextResponse.json(
      { ok: false, taskId, message: "请先登录后再查看降AI进度。" },
      { status: 401 }
    );
  }

  try {
    const currentState = await (dependencies.loadHumanizeStatusForUser ?? loadHumanizeStateWithSupabase)(
      taskId,
      user.id
    );

    return NextResponse.json(
      {
        ok: true,
        taskId,
        humanizeStatus: currentState.status,
        requestedAt: currentState.requestedAt ?? null,
        completedAt: currentState.completedAt ?? null,
        errorMessage: currentState.errorMessage,
        downloads: {
          humanizedDocxOutputId: currentState.outputId
        },
        provider: currentState.provider ?? "undetectable"
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "TASK_NOT_FOUND") {
      return NextResponse.json(
        { ok: false, taskId, message: "未找到这个任务。" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        taskId,
        message: error instanceof Error ? error.message : "读取降AI状态失败，请稍后再试。"
      },
      { status: 500 }
    );
  }
}

async function loadTaskContextWithSupabase(
  taskId: string,
  userId: string
): Promise<HumanizeTaskContext> {
  const task = await getOwnedTaskFromSupabase(taskId, userId);

  if (!task) {
    throw new Error("TASK_NOT_FOUND");
  }

  const draft = await getLatestOwnedDraftFromSupabase(taskId, userId);

  if (!draft) {
    throw new Error("DRAFT_NOT_FOUND");
  }

  if (!task.citationStyle) {
    throw new Error("TASK_CITATION_STYLE_NOT_READY");
  }

  const draftMarkdown = composeHumanizeDraftMarkdown({
    draftBodyMarkdown: draft.bodyMarkdown,
    draftReferencesMarkdown: draft.referencesMarkdown
  });

  return {
    task: {
      id: task.id,
      userId: task.userId,
      status: task.status,
      humanizeStatus: task.humanizeStatus ?? "idle",
      citationStyle: task.citationStyle
    },
    draftMarkdown,
    bodyWordCount: draft.bodyWordCount || countBodyWords(draft.bodyMarkdown)
  };
}

async function loadHumanizeStateWithSupabase(
  taskId: string,
  userId: string
): Promise<HumanizeStateSnapshot> {
  const task = await getOwnedTaskFromSupabase(taskId, userId);

  if (!task) {
    throw new Error("TASK_NOT_FOUND");
  }

  const outputs = await listOwnedTaskOutputs({
    taskId,
    userId
  });

  return {
    status: task.humanizeStatus ?? "idle",
    provider: task.humanizeProvider ?? "undetectable",
    outputId: pickPreferredHumanizedOutputId(
      outputs.map((output) => ({
        id: output.id,
        outputKind: output.outputKind,
        isActive: output.isActive,
        createdAt: output.createdAt
      }))
    ),
    errorMessage: task.humanizeErrorMessage ?? null,
    requestedAt: task.humanizeRequestedAt ?? null,
    completedAt: task.humanizeCompletedAt ?? null
  };
}

async function chargeHumanizeQuotaWithSupabase(
  taskId: string,
  userId: string,
  bodyWordCount: number
): Promise<HumanizeChargeResult> {
  const amount = quoteHumanizeTaskCost(bodyWordCount);
  const wallet = await getUserWalletFromSupabase(userId);
  let frozen;

  try {
    frozen = freezeQuota({
      wallet,
      amount,
      taskId,
      chargePath: "humanize"
    });
  } catch {
    throw new Error("INSUFFICIENT_QUOTA");
  }

  await setUserWalletInSupabase(userId, frozen.wallet);
  await appendPaymentLedgerEntryToSupabase({
    userId,
    taskId,
    entry: frozen.entry,
    walletAfter: frozen.wallet
  });

  return {
    amount,
    reservation: frozen.reservation
  };
}

async function releaseQueuedHumanizeQuotaWithSupabase(input: {
  taskId: string;
  userId: string;
  reservation: FrozenQuotaReservation;
}) {
  const wallet = await getUserWalletFromSupabase(input.userId);
  const released = releaseQuota({
    wallet,
    reservation: input.reservation
  });
  await setUserWalletInSupabase(input.userId, released.wallet);
  await appendPaymentLedgerEntryToSupabase({
    userId: input.userId,
    taskId: input.taskId,
    entry: released.entry,
    walletAfter: released.wallet
  });
}

async function saveQueuedHumanizeStateWithSupabase(input: {
  taskId: string;
  userId: string;
}) {
  await updateOwnedTaskHumanizeStateInSupabase(input.taskId, input.userId, {
    status: "queued",
    provider: "undetectable",
    profileSnapshot: defaultHumanizeProfile,
    documentId: null,
    retryDocumentId: null,
    errorMessage: null,
    requestedAt: new Date().toISOString(),
    completedAt: null
  });
}

async function saveFailedHumanizeStateWithSupabase(input: {
  taskId: string;
  userId: string;
  message: string;
}) {
  await updateOwnedTaskHumanizeStateInSupabase(input.taskId, input.userId, {
    status: "failed",
    errorMessage: input.message,
    completedAt: null
  });
}

async function enqueueHumanizeWithTrigger(input: {
  taskId: string;
  userId: string;
  draftMarkdown: string;
  reservationSnapshot: FrozenQuotaReservation;
  citationStyle: string;
}) {
  await tasks.trigger("humanize-draft", input, {
    queue: "humanize-draft",
    concurrencyKey: `humanize-${input.taskId}`,
    idempotencyKey: `humanize-${input.taskId}-${input.userId}`
  });
}

export async function POST(request: Request, context: RouteContext) {
  return handleHumanizeRequest(request, context);
}

export async function GET(request: Request, context: RouteContext) {
  return handleHumanizeStatusRequest(request, context);
}

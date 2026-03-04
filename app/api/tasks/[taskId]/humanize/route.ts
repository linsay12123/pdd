import { NextResponse } from "next/server";
import { requireCurrentSessionUser } from "@/src/lib/auth/current-user";
import { freezeQuota } from "@/src/lib/billing/freeze-quota";
import { quoteHumanizeTaskCost } from "@/src/lib/billing/quote-task-cost";
import { countBodyWords } from "@/src/lib/drafts/word-count";
import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import {
  appendPaymentLedgerEntryToSupabase,
  getUserWalletFromSupabase,
  setUserWalletInSupabase
} from "@/src/lib/payments/supabase-wallet";
import {
  getLatestOwnedDraftFromSupabase,
  getOwnedTaskFromSupabase
} from "@/src/lib/tasks/supabase-task-records";
import { humanizeDraft } from "@/trigger/jobs/humanize-draft";
import type { FrozenQuotaReservation } from "@/src/types/billing";
import type { SessionUser } from "@/src/types/auth";
import type { TaskSummary } from "@/src/types/tasks";

type RouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

type HumanizeTaskContext = {
  task: Pick<TaskSummary, "id" | "userId" | "status"> & {
    citationStyle: string;
  };
  draftMarkdown: string;
  bodyWordCount: number;
};

type HumanizeChargeResult = {
  amount: number;
  reservation: FrozenQuotaReservation;
};

type HumanizeRouteDependencies = {
  requireUser?: () => Promise<SessionUser>;
  isPersistenceReady?: () => boolean;
  loadTaskContext?: (taskId: string, userId: string) => Promise<HumanizeTaskContext>;
  chargeQuota?: (
    taskId: string,
    userId: string,
    bodyWordCount: number
  ) => Promise<HumanizeChargeResult>;
  runHumanize?: (input: {
    taskId: string;
    userId: string;
    draftMarkdown: string;
    reservationSnapshot: FrozenQuotaReservation;
    citationStyle: string;
  }) => Promise<{
    outputId: string | null;
  }>;
};

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

  if (!process.env.STEALTHGPT_API_KEY?.trim()) {
    return NextResponse.json(
      { ok: false, taskId, message: "自动降AI功能暂未启用，请先配置真实服务密钥。" },
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
    const charged = await (dependencies.chargeQuota ?? chargeHumanizeQuotaWithSupabase)(
      taskId,
      user.id,
      taskContext.bodyWordCount
    );
    const result = await (dependencies.runHumanize ?? runHumanizeWithRealPipeline)({
      taskId,
      userId: user.id,
      draftMarkdown: taskContext.draftMarkdown,
      reservationSnapshot: charged.reservation,
      citationStyle: taskContext.task.citationStyle
    });

    return NextResponse.json(
      {
        ok: true,
        taskId,
        chargedQuota: charged.amount,
        downloads: {
          humanizedDocxOutputId: result.outputId
        },
        message: "降AI处理已完成，现在可以直接下载新文档。"
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

  const draftMarkdown = [
    draft.title ? `# ${draft.title}` : "",
    draft.bodyMarkdown,
    draft.referencesMarkdown ? `## References\n${draft.referencesMarkdown}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    task: {
      id: task.id,
      userId: task.userId,
      status: task.status,
      citationStyle: task.citationStyle
    },
    draftMarkdown,
    bodyWordCount: draft.bodyWordCount || countBodyWords(draft.bodyMarkdown)
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

async function runHumanizeWithRealPipeline(input: {
  taskId: string;
  userId: string;
  draftMarkdown: string;
  reservationSnapshot: FrozenQuotaReservation;
  citationStyle: string;
}) {
  const result = await humanizeDraft(input);

  return {
    outputId: result.outputId ?? null
  };
}

export async function POST(request: Request, context: RouteContext) {
  return handleHumanizeRequest(request, context);
}

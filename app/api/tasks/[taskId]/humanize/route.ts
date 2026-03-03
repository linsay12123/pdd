import { NextResponse } from "next/server";
import { requireCurrentSessionUser } from "@/src/lib/auth/current-user";
import { countBodyWords } from "@/src/lib/drafts/word-count";
import { quoteHumanizeTaskCost } from "@/src/lib/billing/quote-task-cost";
import { freezeQuota } from "@/src/lib/billing/freeze-quota";
import {
  appendPaymentLedgerEntry,
  getUserWallet,
  setUserWallet
} from "@/src/lib/payments/repository";
import {
  getTaskSummary,
  listTaskDraftVersions
} from "@/src/lib/tasks/repository";
import { queueHumanizeDraft } from "@/trigger/jobs/humanize-draft";
import type { SessionUser } from "@/src/types/auth";

type RouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

type HumanizeRouteDependencies = {
  requireUser?: () => Promise<SessionUser>;
};

export async function handleHumanizeRequest(
  request: Request,
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

  const task = getTaskSummary(taskId);

  if (!task || task.userId !== user.id) {
    return NextResponse.json(
      { ok: false, taskId, message: "未找到这个任务。" },
      { status: 404 }
    );
  }

  const draftVersions = listTaskDraftVersions(taskId);
  const activeDraft =
    draftVersions.find((v) => v.isActive) ?? draftVersions[draftVersions.length - 1];

  if (!activeDraft) {
    return NextResponse.json(
      { ok: false, taskId, message: "找不到已生成的正文，请先完成文章生成。" },
      { status: 400 }
    );
  }

  const draftMarkdown = [
    activeDraft.title ? `# ${activeDraft.title}` : "",
    activeDraft.bodyMarkdown,
    activeDraft.referencesMarkdown
      ? `## References\n${activeDraft.referencesMarkdown}`
      : ""
  ]
    .filter(Boolean)
    .join("\n\n");

  const bodyWordCount = countBodyWords(draftMarkdown);
  const quotaCost = quoteHumanizeTaskCost(bodyWordCount);

  const wallet = getUserWallet(user.id);
  let frozen;

  try {
    frozen = freezeQuota({
      wallet,
      amount: quotaCost,
      taskId,
      chargePath: "humanize"
    });
  } catch {
    return NextResponse.json(
      { ok: false, taskId, message: "积分不足，请充值后再试。" },
      { status: 400 }
    );
  }

  setUserWallet(user.id, frozen.wallet);
  appendPaymentLedgerEntry(user.id, frozen.entry);

  const queuedJob = await queueHumanizeDraft({
    taskId,
    draftMarkdown,
    userId: user.id,
    reservationSnapshot: frozen.reservation
  });

  return NextResponse.json(
    {
      ok: true,
      taskId,
      frozenQuota: quotaCost,
      queuedJob,
      message: "降AI处理已排队，完成后可下载新文档。"
    },
    { status: 202 }
  );
}

export async function POST(request: Request, context: RouteContext) {
  return handleHumanizeRequest(request, context);
}

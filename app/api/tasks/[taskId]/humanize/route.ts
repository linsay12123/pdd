import { NextResponse } from "next/server";
import { countBodyWords } from "@/src/lib/drafts/word-count";
import { getTaskSummary } from "@/src/lib/tasks/repository";
import { queueHumanizeDraft } from "@/trigger/jobs/humanize-draft";

type RouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

type HumanizeRequestBody = {
  draftMarkdown?: string;
};

export async function POST(request: Request, context: RouteContext) {
  const { taskId } = await context.params;
  const task = getTaskSummary(taskId);

  if (!task) {
    return NextResponse.json(
      {
        ok: false,
        taskId,
        message: "未找到这个任务，暂时不能开始降 AI。"
      },
      { status: 404 }
    );
  }

  const body = (await request.json().catch(() => null)) as HumanizeRequestBody | null;
  const draftMarkdown = body?.draftMarkdown?.trim();

  if (!draftMarkdown) {
    return NextResponse.json(
      {
        ok: false,
        taskId,
        message: "要先提供当前英文正文，系统才能开始自动降 AI。"
      },
      { status: 400 }
    );
  }

  const estimatedQuotaCost = Math.max(1, Math.ceil(countBodyWords(draftMarkdown) / 500));
  const queuedJob = await queueHumanizeDraft({
    taskId,
    draftMarkdown
  });

  return NextResponse.json(
    {
      ok: true,
      taskId,
      estimatedQuotaCost,
      frozenQuota: estimatedQuotaCost,
      queuedJob,
      message:
        "自动降 AI 已进入排队。当前先按预估额度冻结，后面的真实扣费会在计费引擎接入后替换。"
    },
    { status: 202 }
  );
}

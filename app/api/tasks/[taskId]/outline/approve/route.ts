import { NextResponse } from "next/server";
import { requireCurrentSessionUser } from "@/src/lib/auth/current-user";
import { buildSafetyIdentifier } from "@/src/lib/ai/safety-identifier";
import { countBodyWords } from "@/src/lib/drafts/word-count";
import { processApprovedTask } from "@/src/lib/tasks/process-approved-task";
import { approveOutlineVersion } from "@/src/lib/tasks/save-outline-version";
import { toSessionTaskPayload } from "@/src/lib/tasks/session-task";
import type { SessionUser } from "@/src/types/auth";

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
    await approveOutlineVersion({
      taskId: params.taskId,
      userId: user.id,
      outlineVersionId: body?.outlineVersionId?.trim() || undefined
    });
    const processed = await (dependencies.processTask ?? processApprovedTask)(
      {
        taskId: params.taskId,
        userId: user.id,
        safetyIdentifier: buildSafetyIdentifier(user.id)
      }
    );

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

    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "确认大纲失败"
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { taskId } = await context.params;
  return handleOutlineApprovalRequest(request, { taskId });
}

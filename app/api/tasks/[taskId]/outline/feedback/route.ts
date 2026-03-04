import { NextResponse } from "next/server";
import { requireCurrentSessionUser } from "@/src/lib/auth/current-user";
import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import { reviseOutlineVersion } from "@/src/lib/tasks/save-outline-version";
import {
  toSessionTaskHumanizePayload,
  toSessionTaskPayload
} from "@/src/lib/tasks/session-task";
import type { SessionUser } from "@/src/types/auth";

type RouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

type OutlineFeedbackBody = {
  feedback?: string;
};

type OutlineFeedbackDependencies = {
  requireUser?: () => Promise<SessionUser>;
  isPersistenceReady?: () => boolean;
  reviseOutline?: typeof reviseOutlineVersion;
};

export async function handleOutlineFeedbackRequest(
  request: Request,
  params: {
    taskId: string;
  },
  dependencies: OutlineFeedbackDependencies = {}
) {
  const body = (await request.json().catch(() => null)) as OutlineFeedbackBody | null;
  const feedback = body?.feedback?.trim() ?? "";

  if (!feedback) {
    return NextResponse.json(
      {
        ok: false,
        message: "请先输入你想修改的大纲意见。"
      },
      { status: 400 }
    );
  }

  try {
    if (!(dependencies.isPersistenceReady ?? shouldUseSupabasePersistence)()) {
      return NextResponse.json(
        {
          ok: false,
          message: "系统现在还没连上正式任务数据库，所以大纲暂时不能重新生成。"
        },
        { status: 503 }
      );
    }

    const user = await (dependencies.requireUser ?? requireCurrentSessionUser)();
    const result = await (dependencies.reviseOutline ?? reviseOutlineVersion)({
      taskId: params.taskId,
      userId: user.id,
      feedback
    });

    return NextResponse.json(
      {
        ok: true,
        task: toSessionTaskPayload(result.task),
        humanize: toSessionTaskHumanizePayload(result.task),
        outlineVersion: result.outlineVersion,
        outline: result.outlineVersion.outline,
        message: "系统已经根据你的意见生成了新一版大纲。"
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json(
        {
          ok: false,
          message: "请先登录后再修改大纲。"
        },
        { status: 401 }
      );
    }

    if (error instanceof Error && error.message === "OUTLINE_REVISION_LIMIT_REACHED") {
      return NextResponse.json(
        {
          ok: false,
          message: "大纲修改次数已经到上限，请联系客服支持团队协助。"
        },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === "TASK_NOT_FOUND") {
      return NextResponse.json(
        {
          ok: false,
          message: "没有找到这个任务，暂时不能修改大纲。"
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "修改大纲失败"
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { taskId } = await context.params;
  return handleOutlineFeedbackRequest(request, { taskId });
}

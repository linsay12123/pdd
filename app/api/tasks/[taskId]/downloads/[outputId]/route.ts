import { NextResponse } from "next/server";
import { requireCurrentSessionUser } from "@/src/lib/auth/current-user";
import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import { createSignedDownloadUrl } from "@/src/lib/storage/signed-url";
import { getOwnedTaskOutput } from "@/src/lib/tasks/task-output-store";
import type { SessionUser } from "@/src/types/auth";

type RouteContext = {
  params: Promise<{
    taskId: string;
    outputId: string;
  }>;
};

type TaskDownloadRouteDependencies = {
  requireUser?: () => Promise<SessionUser>;
  isPersistenceReady?: () => boolean;
};

export async function handleTaskDownloadRequest(
  request: Request,
  params: {
    taskId: string;
    outputId: string;
  },
  dependencies: TaskDownloadRouteDependencies = {}
) {
  let user: SessionUser;

  if (!(dependencies.isPersistenceReady ?? shouldUseSupabasePersistence)()) {
    return NextResponse.json(
      {
        ok: false,
        message: "系统现在还没连上正式任务数据库，所以下载文件暂时不能读取。"
      },
      { status: 503 }
    );
  }

  try {
    user = await (dependencies.requireUser ?? requireCurrentSessionUser)();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "请先登录后再下载文件。"
      },
      { status: 401 }
    );
  }

  const output = await getOwnedTaskOutput({
    taskId: params.taskId,
    outputId: params.outputId,
    userId: user.id
  });

  if (!output) {
    return NextResponse.json(
      {
        ok: false,
        message: "没有找到这个下载文件。"
      },
      { status: 404 }
    );
  }

  try {
    const signedUrl = createSignedDownloadUrl({
      output,
      userId: user.id
    });

    return NextResponse.json({
      ok: true,
      output,
      signedUrl
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        output,
        message:
          error instanceof Error ? error.message : "当前文件暂时不能下载。"
      },
      { status: 410 }
    );
  }
}

export async function GET(request: Request, context: RouteContext) {
  const params = await context.params;
  return handleTaskDownloadRequest(request, params);
}

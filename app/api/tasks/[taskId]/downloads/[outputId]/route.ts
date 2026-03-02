import { NextResponse } from "next/server";
import { requireCurrentSessionUser } from "@/src/lib/auth/current-user";
import { createSignedDownloadUrl } from "@/src/lib/storage/signed-url";
import { getTaskOutput } from "@/src/lib/tasks/repository";
import type { SessionUser } from "@/src/types/auth";

type RouteContext = {
  params: Promise<{
    taskId: string;
    outputId: string;
  }>;
};

type TaskDownloadRouteDependencies = {
  requireUser?: () => Promise<SessionUser>;
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

  const output = getTaskOutput(params.taskId, params.outputId);

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

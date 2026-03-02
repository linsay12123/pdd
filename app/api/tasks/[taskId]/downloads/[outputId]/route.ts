import { NextResponse } from "next/server";
import { createSignedDownloadUrl } from "@/src/lib/storage/signed-url";
import { getTaskOutput } from "@/src/lib/tasks/repository";

type RouteContext = {
  params: Promise<{
    taskId: string;
    outputId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { taskId, outputId } = await context.params;
  const userId = new URL(request.url).searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      {
        ok: false,
        message: "下载前必须先确认当前用户。"
      },
      { status: 400 }
    );
  }

  const output = getTaskOutput(taskId, outputId);

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
      userId
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

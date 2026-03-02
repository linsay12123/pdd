import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { taskId } = await context.params;

  return NextResponse.json(
    {
      ok: false,
      taskId,
      message:
        "Outline feedback endpoint stub is ready. Revision counting and persistence will be added in the next pass."
    },
    { status: 501 }
  );
}

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
        "Primary requirement file confirmation stub is in place. Persistence will be added in the next implementation pass."
    },
    { status: 501 }
  );
}

import { NextResponse } from "next/server";
import { requireCurrentSessionUser } from "@/src/lib/auth/current-user";
import { createTaskWithQuotaFreeze } from "@/src/lib/tasks/create-task";
import { toSessionTaskPayload } from "@/src/lib/tasks/session-task";
import type { SessionUser } from "@/src/types/auth";

type CreateTaskBody = {
  specialRequirements?: string;
  targetWordCount?: number;
  citationStyle?: string;
};

type CreateTaskRouteDependencies = {
  requireUser?: () => Promise<SessionUser>;
  createTask?: typeof createTaskWithQuotaFreeze;
};

export async function handleTaskCreateRequest(
  request: Request,
  dependencies: CreateTaskRouteDependencies = {}
) {
  const body = (await request.json().catch(() => null)) as CreateTaskBody | null;

  try {
    const user = await (dependencies.requireUser ?? requireCurrentSessionUser)();
    const createTask = dependencies.createTask ?? createTaskWithQuotaFreeze;
    const result = await createTask({
      user,
      specialRequirements: body?.specialRequirements?.trim() ?? "",
      targetWordCount:
        typeof body?.targetWordCount === "number" && body.targetWordCount > 0
          ? body.targetWordCount
          : 2000,
      citationStyle: body?.citationStyle?.trim() || "APA 7"
    });

    return NextResponse.json(
      {
        ok: true,
        task: toSessionTaskPayload(result.task),
        frozenQuota: result.frozenQuota,
        message: "任务已创建，500 积分已冻结。"
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json(
        {
          ok: false,
          message: "请先登录后再创建任务。"
        },
        { status: 401 }
      );
    }

    if (error instanceof Error && error.message === "ACCOUNT_FROZEN") {
      return NextResponse.json(
        {
          ok: false,
          message: "当前账号已被冻结，请联系销售团队处理。"
        },
        { status: 403 }
      );
    }

    if (error instanceof Error && error.message === "INSUFFICIENT_QUOTA") {
      return NextResponse.json(
        {
          ok: false,
          message: "当前积分不足 500，请先充值后再创建任务。"
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "创建任务失败"
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return handleTaskCreateRequest(request);
}

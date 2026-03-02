import { NextResponse } from "next/server";
import { requireAdminSession } from "@/src/lib/auth/admin-guard";
import { createActivationCodes } from "@/src/lib/activation-codes/repository";
import { createActivationCodesInSupabase } from "@/src/lib/activation-codes/supabase-repository";
import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import type { SessionUser } from "@/src/types/auth";

type CreateActivationCodesBody = {
  tier?: number;
  count?: number;
};

type CreateActivationCodesRouteDependencies = {
  requireUser?: () => Promise<SessionUser>;
};

export async function handleCreateActivationCodesRequest(
  request: Request,
  dependencies: CreateActivationCodesRouteDependencies = {}
) {
  try {
    await requireAdminSession({
      requireUser: dependencies.requireUser
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_REQUIRED") {
      return NextResponse.json(
        {
          ok: false,
          message: "只有管理员可以生成激活码。"
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message: "请先登录管理员账号。"
      },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => null)) as CreateActivationCodesBody | null;

  if (!body || typeof body.tier !== "number" || typeof body.count !== "number") {
    return NextResponse.json(
      {
        ok: false,
        message: "需要 tier 和 count 才能生成激活码。"
      },
      { status: 400 }
    );
  }

  try {
    const input = {
      tier: body.tier as 1000 | 5000 | 10000 | 20000,
      count: body.count
    };
    const codes = shouldUseSupabasePersistence()
      ? await createActivationCodesInSupabase(input)
      : createActivationCodes(input);

    return NextResponse.json({
      ok: true,
      codes
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "激活码生成失败"
      },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  return handleCreateActivationCodesRequest(request);
}

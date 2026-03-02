import { NextResponse } from "next/server";
import { isAdminRequest } from "@/src/lib/auth/admin-guard";
import { createActivationCodes } from "@/src/lib/activation-codes/repository";
import { createActivationCodesInSupabase } from "@/src/lib/activation-codes/supabase-repository";
import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";

type CreateActivationCodesBody = {
  tier?: number;
  count?: number;
};

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json(
      {
        ok: false,
        message: "只有管理员可以生成激活码。"
      },
      { status: 403 }
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

import { NextResponse } from "next/server";
import { isAdminRequest } from "@/src/lib/auth/admin-guard";
import { listActivationCodes } from "@/src/lib/activation-codes/repository";
import { listActivationCodesInSupabase } from "@/src/lib/activation-codes/supabase-repository";
import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import type { ActivationCodeStatus } from "@/src/types/activation-codes";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json(
      {
        ok: false,
        message: "只有管理员可以查看激活码列表。"
      },
      { status: 403 }
    );
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const keyword = url.searchParams.get("keyword");
  const normalizedStatus: ActivationCodeStatus | undefined =
    status === "used" || status === "unused" ? status : undefined;
  try {
    const query = {
      status: normalizedStatus,
      keyword: keyword ?? undefined
    };
    const codes = shouldUseSupabasePersistence()
      ? await listActivationCodesInSupabase(query)
      : listActivationCodes(query);

    return NextResponse.json({
      ok: true,
      codes
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "读取激活码列表失败"
      },
      { status: 500 }
    );
  }
}

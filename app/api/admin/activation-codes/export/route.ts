import { NextResponse } from "next/server";
import { requireAdminSession } from "@/src/lib/auth/admin-guard";
import { listActivationCodes } from "@/src/lib/activation-codes/repository";
import { listActivationCodesInSupabase } from "@/src/lib/activation-codes/supabase-repository";
import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import type { ActivationCodeStatus } from "@/src/types/activation-codes";
import type { SessionUser } from "@/src/types/auth";

function buildCsvLine(columns: string[]) {
  return columns
    .map((column) => `"${column.replaceAll('"', '""')}"`)
    .join(",");
}

type ExportActivationCodesRouteDependencies = {
  requireUser?: () => Promise<SessionUser>;
};

export async function handleExportActivationCodesRequest(
  request: Request,
  dependencies: ExportActivationCodesRouteDependencies = {}
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
          message: "只有管理员可以导出激活码列表。"
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
    const header = [
      "code",
      "tier",
      "status",
      "used_by_user_id",
      "used_by_user_email",
      "used_by_display_name",
      "created_at",
      "used_at"
    ];
    const rows = codes.map((code) => [
      code.code,
      String(code.tier),
      code.usedByUserId ? "used" : "unused",
      code.usedByUserId ?? "",
      code.usedByEmail ?? "",
      code.usedByDisplayName ?? "",
      code.createdAt,
      code.usedAt ?? ""
    ]);
    const csv = [buildCsvLine(header), ...rows.map(buildCsvLine)].join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="activation-codes-${Date.now()}.csv"`
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "导出激活码失败"
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return handleExportActivationCodesRequest(request);
}

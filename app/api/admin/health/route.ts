import { NextResponse } from "next/server";
import { requireAdminSession } from "@/src/lib/auth/admin-guard";
import {
  runHealthDiagnostics,
  type HealthDiagnosticsPayload
} from "@/src/lib/health/diagnostics";
import type { SessionUser } from "@/src/types/auth";

type AdminHealthRouteDependencies = {
  requireAdmin?: () => Promise<SessionUser>;
  runDiagnostics?: () => Promise<HealthDiagnosticsPayload>;
};

export const dynamic = "force-dynamic";

export async function handleAdminHealthRequest(
  dependencies: AdminHealthRouteDependencies = {}
) {
  try {
    await (dependencies.requireAdmin ?? requireAdminSession)();
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_REQUIRED") {
      return NextResponse.json(
        {
          ok: false,
          message: "只有管理员可以查看完整健康检查。"
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

  const diagnostics = await (dependencies.runDiagnostics ?? runHealthDiagnostics)();
  return NextResponse.json(
    {
      status: diagnostics.status,
      timestamp: diagnostics.timestamp,
      checks: diagnostics.checks
    },
    {
      status: diagnostics.httpStatus
    }
  );
}

export async function GET() {
  return handleAdminHealthRequest();
}

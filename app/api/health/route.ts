import { NextResponse } from "next/server";
import {
  runHealthDiagnostics,
  type HealthDiagnosticsPayload
} from "@/src/lib/health/diagnostics";

type PublicHealthRouteDependencies = {
  runDiagnostics?: () => Promise<HealthDiagnosticsPayload>;
};

export const dynamic = "force-dynamic";

export async function handleHealthRequest(
  dependencies: PublicHealthRouteDependencies = {}
) {
  const diagnostics = await (dependencies.runDiagnostics ?? runHealthDiagnostics)();

  return NextResponse.json(
    {
      status: diagnostics.status === "healthy" ? "ok" : "degraded",
      timestamp: diagnostics.timestamp
    },
    { status: diagnostics.httpStatus }
  );
}

export async function GET() {
  return handleHealthRequest();
}

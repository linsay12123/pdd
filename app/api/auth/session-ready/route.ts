import { NextResponse } from "next/server";
import {
  getCurrentSessionUserResolution,
  type SessionUserResolution
} from "@/src/lib/auth/current-user";

type HandleSessionReadyDependencies = {
  getResolution?: () => Promise<SessionUserResolution>;
};

export async function handleSessionReadyRequest(
  dependencies: HandleSessionReadyDependencies = {}
) {
  try {
    const resolution = await (dependencies.getResolution ?? getCurrentSessionUserResolution)();
    return NextResponse.json({
      ready: resolution.status === "ready",
      reason: resolution.status
    });
  } catch {
    return NextResponse.json({
      ready: false,
      reason: "anonymous"
    });
  }
}

export async function GET() {
  return handleSessionReadyRequest();
}

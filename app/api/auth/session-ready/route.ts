import { NextResponse } from "next/server";
import {
  getCurrentSessionUserResolution,
  type SessionUserResolution
} from "@/src/lib/auth/current-user";
import { ensureSessionUserBootstrap } from "@/src/lib/auth/session-bootstrap";

type HandleSessionReadyDependencies = {
  getResolution?: () => Promise<SessionUserResolution>;
  ensureBootstrap?: (input: {
    authUserId: string;
    email: string;
  }) => Promise<void>;
};

export async function handleSessionReadyRequest(
  dependencies: HandleSessionReadyDependencies = {}
) {
  try {
    const getResolution =
      dependencies.getResolution ?? getCurrentSessionUserResolution;
    let resolution = await getResolution();

    if (resolution.status === "profile_missing") {
      await (dependencies.ensureBootstrap ?? ensureSessionUserBootstrap)({
        authUserId: resolution.authUserId,
        email: resolution.email
      });
      resolution = await getResolution();
    }

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

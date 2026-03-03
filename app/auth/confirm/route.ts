import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { normalizeRedirectTarget } from "@/src/lib/auth/auth-form";
import { getAuthConfirmErrorMessage } from "@/src/lib/auth/register-flow";
import { getPasswordResetLinkErrorMessage } from "@/src/lib/auth/password-reset-flow";

type VerifyOtpInput = {
  token_hash: string;
  type:
    | "email"
    | "signup"
    | "invite"
    | "magiclink"
    | "recovery"
    | "email_change";
};

type SupabaseAuthClient = {
  exchangeCodeForSession: (code: string) => Promise<{ error: Error | null }>;
  verifyOtp: (input: VerifyOtpInput) => Promise<{ error: Error | null }>;
};

type SupabaseServerClient = {
  auth: SupabaseAuthClient;
};

type AuthConfirmRouteDependencies = {
  createClient?: () => Promise<SupabaseServerClient>;
  exchangeCodeForSession?: (code: string) => Promise<{ error: Error | null }>;
  verifyOtp?: (input: VerifyOtpInput) => Promise<{ error: Error | null }>;
};

function buildRedirectUrl(requestUrl: string, target: string) {
  return new URL(target, requestUrl);
}

export async function handleAuthConfirmRequest(
  request: Request,
  dependencies: AuthConfirmRouteDependencies = {}
) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const nextPath = normalizeRedirectTarget(
    url.searchParams.get("next") ?? (type === "recovery" ? "/reset-password" : "/workspace")
  );
  const client = await (dependencies.createClient ?? createSupabaseServerClient)();
  const exchangeCodeForSession =
    dependencies.exchangeCodeForSession ?? client.auth.exchangeCodeForSession.bind(client.auth);
  const verifyOtp = dependencies.verifyOtp ?? client.auth.verifyOtp.bind(client.auth);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");

  if (code) {
    const { error } = await exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(buildRedirectUrl(request.url, nextPath));
    }
  }

  if (tokenHash && type) {
    const { error } = await verifyOtp({
      token_hash: tokenHash,
      type: type as VerifyOtpInput["type"]
    });

    if (!error) {
      return NextResponse.redirect(buildRedirectUrl(request.url, nextPath));
    }
  }

  if (type === "recovery") {
    const forgotPasswordUrl = buildRedirectUrl(request.url, "/forgot-password");
    forgotPasswordUrl.searchParams.set("message", getPasswordResetLinkErrorMessage());
    return NextResponse.redirect(forgotPasswordUrl);
  }

  const loginUrl = buildRedirectUrl(request.url, "/login");
  loginUrl.searchParams.set("message", getAuthConfirmErrorMessage());
  return NextResponse.redirect(loginUrl);
}

export async function GET(request: Request) {
  return handleAuthConfirmRequest(request);
}

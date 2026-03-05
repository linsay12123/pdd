import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/src/config/env";

export const protectedPathPrefixes = [
  "/workspace",
  "/tasks",
  "/billing",
  "/recharge",
  "/account",
  "/admin"
] as const;

export const apiAnonymousAllowlist = [
  "/api/auth/register",
  "/api/auth/session-ready",
  "/api/auth/sync-session",
  "/api/health"
] as const;

export function isProtectedPath(pathname: string) {
  return protectedPathPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function isApiPath(pathname: string) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

export function isAnonymousApiPath(pathname: string) {
  return apiAnonymousAllowlist.some(
    (allowed) => pathname === allowed || pathname.startsWith(`${allowed}/`)
  );
}

export function hasSupabaseSessionCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token")
    );
}

export async function proxy(request: NextRequest) {
  const passthroughResponse = NextResponse.next();
  const authenticated = await resolveSessionState(request, passthroughResponse);

  if (isApiPath(request.nextUrl.pathname)) {
    if (request.method === "OPTIONS" || isAnonymousApiPath(request.nextUrl.pathname)) {
      return passthroughResponse;
    }

    if (authenticated) {
      return passthroughResponse;
    }

    return NextResponse.json(
      {
        ok: false,
        message: "请先登录后再访问这个接口。"
      },
      { status: 401 }
    );
  }

  if (!isProtectedPath(request.nextUrl.pathname)) {
    return passthroughResponse;
  }

  if (authenticated) {
    return passthroughResponse;
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirect", request.nextUrl.pathname);

  return NextResponse.redirect(loginUrl);
}

async function resolveSessionState(request: NextRequest, response: NextResponse) {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return hasSupabaseSessionCookie(request);
  }

  try {
    const client = createServerClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookieValues) {
            cookieValues.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          }
        }
      }
    );

    const authResult = await client.auth.getUser();
    return Boolean(authResult.data.user);
  } catch {
    return hasSupabaseSessionCookie(request);
  }
}

export const config = {
  matcher: [
    "/api/:path*",
    "/workspace/:path*",
    "/tasks/:path*",
    "/billing/:path*",
    "/recharge/:path*",
    "/account/:path*",
    "/admin/:path*"
  ]
};

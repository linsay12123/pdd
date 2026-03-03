import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { env } from "@/src/config/env";

type SyncSessionRequestBody = {
  accessToken?: string;
  refreshToken?: string;
};

type SyncSessionClient = {
  auth: {
    setSession: (input: {
      access_token: string;
      refresh_token: string;
    }) => Promise<{
      error: {
        message?: string | null;
      } | null;
    }>;
  };
};

type HandleSyncSessionDependencies = {
  createClient?: () => Promise<SyncSessionClient> | SyncSessionClient;
};

async function createResponseBoundClient(response: NextResponse) {
  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookieValues) {
          cookieValues.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        }
      }
    }
  ) as SyncSessionClient;
}

export async function handleSyncSessionRequest(
  request: Request,
  dependencies: HandleSyncSessionDependencies = {}
) {
  let body: SyncSessionRequestBody;

  try {
    body = (await request.json()) as SyncSessionRequestBody;
  } catch {
    return NextResponse.json(
      { message: "登录状态不完整，请重新登录。" },
      { status: 400 }
    );
  }

  const accessToken = body.accessToken?.trim() ?? "";
  const refreshToken = body.refreshToken?.trim() ?? "";

  if (!accessToken || !refreshToken) {
    return NextResponse.json(
      { message: "登录状态不完整，请重新登录。" },
      { status: 400 }
    );
  }

  try {
    const response = NextResponse.json({ ok: true });
    const client =
      (await dependencies.createClient?.()) ??
      (await createResponseBoundClient(response));
    const { error } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    if (error) {
      return NextResponse.json(
        { message: error.message ?? "同步登录状态失败，请重新登录。" },
        { status: 500 }
      );
    }

    return response;
  } catch {
    return NextResponse.json(
      { message: "同步登录状态失败，请重新登录。" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return handleSyncSessionRequest(request);
}

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

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
    const client =
      (await dependencies.createClient?.()) ??
      ((await createSupabaseServerClient()) as SyncSessionClient);
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

    return NextResponse.json({ ok: true });
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

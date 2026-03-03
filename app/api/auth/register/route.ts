import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { validateRegisterInput } from "@/src/lib/auth/auth-form";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

type RegisterRequestBody = {
  displayName?: string;
  email?: string;
  password?: string;
};

type AdminUser = Pick<User, "id" | "email" | "email_confirmed_at" | "last_sign_in_at">;

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

type RegisterRouteDependencies = {
  createAdminClient?: () => AdminClient;
  findUserByEmail?: (input: { client: AdminClient; email: string }) => Promise<AdminUser | null>;
  createUser?: (input: {
    client: AdminClient;
    email: string;
    password: string;
    displayName: string;
  }) => Promise<AdminUser>;
  updateUserById?: (input: {
    client: AdminClient;
    userId: string;
    email: string;
    password: string;
    displayName: string;
  }) => Promise<AdminUser>;
  ensureUserBootstrap?: (input: {
    client: AdminClient;
    userId: string;
    email: string;
    displayName: string;
  }) => Promise<void>;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function canReclaimExistingUser(user: AdminUser) {
  return !user.email_confirmed_at && !user.last_sign_in_at;
}

async function findUserByEmail(input: { client: AdminClient; email: string }) {
  let page = 1;

  while (true) {
    const { data, error } = await input.client.auth.admin.listUsers({
      page,
      perPage: 200
    });

    if (error) {
      throw new Error(`读取账号列表失败：${error.message}`);
    }

    const match = data.users.find(
      (user) => normalizeEmail(user.email ?? "") === normalizeEmail(input.email)
    );
    if (match) {
      return match;
    }

    if (data.users.length < 200) {
      return null;
    }

    page += 1;
  }
}

async function createUser(input: {
  client: AdminClient;
  email: string;
  password: string;
  displayName: string;
}) {
  const { data, error } = await input.client.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      display_name: input.displayName
    }
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? "注册失败，请稍后再试。");
  }

  return data.user;
}

async function updateUserById(input: {
  client: AdminClient;
  userId: string;
  email: string;
  password: string;
  displayName: string;
}) {
  const { data, error } = await input.client.auth.admin.updateUserById(input.userId, {
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      display_name: input.displayName
    }
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? "注册失败，请稍后再试。");
  }

  return data.user;
}

async function ensureUserBootstrap(input: {
  client: AdminClient;
  userId: string;
  email: string;
  displayName: string;
}) {
  const { error: profileError } = await input.client.from("profiles").upsert(
    {
      id: input.userId,
      email: input.email,
      display_name: input.displayName,
      role: "user",
      is_frozen: false
    },
    { onConflict: "id" }
  );

  if (profileError) {
    throw new Error(`写入用户资料失败：${profileError.message}`);
  }

  const { error: walletError } = await input.client.from("quota_wallets").upsert(
    {
      user_id: input.userId,
      recharge_quota: 0,
      subscription_quota: 0,
      frozen_quota: 0
    },
    { onConflict: "user_id" }
  );

  if (walletError) {
    throw new Error(`写入积分钱包失败：${walletError.message}`);
  }
}

export async function handleRegisterRequest(
  request: Request,
  dependencies: RegisterRouteDependencies = {}
) {
  let body: RegisterRequestBody;

  try {
    body = (await request.json()) as RegisterRequestBody;
  } catch {
    return NextResponse.json({ message: "注册信息不完整，请重新填写。" }, { status: 400 });
  }

  const displayName = body.displayName?.trim() ?? "";
  const email = normalizeEmail(body.email ?? "");
  const password = body.password ?? "";

  const validationError = validateRegisterInput({
    displayName,
    email,
    password,
    confirmPassword: password
  });

  if (validationError) {
    return NextResponse.json({ message: validationError }, { status: 400 });
  }

  try {
    const client = dependencies.createAdminClient?.() ?? createSupabaseAdminClient();
    const existingUser = await (dependencies.findUserByEmail ?? findUserByEmail)({
      client,
      email
    });

    let user: AdminUser;
    let status = 201;

    if (existingUser) {
      if (!canReclaimExistingUser(existingUser)) {
        return NextResponse.json(
          { message: "这个邮箱已经注册过了，请直接登录，或点击“忘记密码”重设密码。" },
          { status: 409 }
        );
      }

      user = await (dependencies.updateUserById ?? updateUserById)({
        client,
        userId: existingUser.id,
        email,
        password,
        displayName
      });
      status = 200;
    } else {
      user = await (dependencies.createUser ?? createUser)({
        client,
        email,
        password,
        displayName
      });
    }

    await (dependencies.ensureUserBootstrap ?? ensureUserBootstrap)({
      client,
      userId: user.id,
      email,
      displayName
    });

    return NextResponse.json(
      {
        message: "注册成功，正在进入工作台...",
        userId: user.id
      },
      { status }
    );
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "注册失败，请稍后再试。"
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return handleRegisterRequest(request);
}

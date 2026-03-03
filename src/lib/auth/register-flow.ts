import { normalizeRedirectTarget } from "@/src/lib/auth/auth-form";

type RegisterCompletionMessageInput = {
  email: string;
  hasSession: boolean;
};

export function buildSignupEmailRedirectTo(origin: string, next = "/workspace") {
  const safeNext = normalizeRedirectTarget(next);
  const url = new URL("/auth/confirm", origin);
  url.searchParams.set("next", safeNext);
  return url.toString();
}

export function getRegisterCompletionMessage({
  email,
  hasSession
}: RegisterCompletionMessageInput) {
  if (hasSession) {
    return "注册成功，正在进入工作台...";
  }

  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    return "注册成功，请先去邮箱点击确认邮件，确认完成后再回来登录。";
  }

  return `注册成功，请去邮箱 ${trimmedEmail} 点击确认邮件。确认完成后会自动进入工作台。`;
}

export function getAuthConfirmErrorMessage() {
  return "邮箱确认链接无效或已过期，请重新注册，或回到登录页后再试。";
}

type SignupResendClient = {
  auth: {
    resend: (input: {
      type: "signup";
      email: string;
      options: {
        emailRedirectTo: string;
      };
    }) => Promise<{
      error: {
        message?: string | null;
      } | null;
    }>;
  };
};

type ResendSignupConfirmationInput = {
  email: string;
  origin: string;
  supabase: SignupResendClient;
};

function getResendSignupErrorMessage(error: { message?: string | null } | null | undefined) {
  const message = error?.message?.trim().toLowerCase() ?? "";

  if (message.includes("rate limit")) {
    return "刚刚已经发过确认邮件了，请稍等 1 分钟后再试。";
  }

  if (message.includes("email rate limit exceeded")) {
    return "确认邮件发送太频繁了，请稍后再试。";
  }

  if (message.includes("for security purposes")) {
    return "这个邮箱已经注册完成了，请直接去登录。";
  }

  return "重新发送确认邮件失败，请稍后再试。";
}

export async function resendSignupConfirmation({
  email,
  origin,
  supabase
}: ResendSignupConfirmationInput) {
  const trimmedEmail = email.trim();

  if (!trimmedEmail) {
    throw new Error("请先输入邮箱地址，再重新发送确认邮件。");
  }

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: trimmedEmail,
    options: {
      emailRedirectTo: buildSignupEmailRedirectTo(origin)
    }
  });

  if (error) {
    throw new Error(getResendSignupErrorMessage(error));
  }

  return `确认邮件已经重新发送到 ${trimmedEmail}，请查看收件箱和垃圾箱。`;
}

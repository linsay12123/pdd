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

  return "注册成功，正在进入工作台...";
}

export function getAuthConfirmErrorMessage() {
  return "邮箱确认链接无效或已过期，请重新注册，或回到登录页后再试。";
}

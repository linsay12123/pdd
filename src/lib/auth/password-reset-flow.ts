import { normalizeRedirectTarget } from "@/src/lib/auth/auth-form";

export function buildPasswordResetEmailRedirectTo(origin: string) {
  const url = new URL("/auth/confirm", origin);
  url.searchParams.set("next", normalizeRedirectTarget("/reset-password"));
  return url.toString();
}

export function getPasswordResetCompletionMessage() {
  return "如果这个邮箱已经注册，我们会把重置密码邮件发到您的邮箱，请查看收件箱和垃圾箱。";
}

export function getPasswordResetLinkErrorMessage() {
  return "这个重置密码链接无效或已过期，请重新发送重置密码邮件。";
}

export function getPasswordUpdateSuccessMessage() {
  return "密码已经修改成功，请重新登录。";
}

export function getPasswordResetRequestErrorMessage(error?: { message?: string | null } | null) {
  const message = error?.message?.trim().toLowerCase() ?? "";

  if (message.includes("email rate limit exceeded")) {
    return "邮件发送太频繁了，请稍后再试。";
  }

  return "暂时无法发送重置密码邮件，请稍后再试。";
}

export function getPasswordUpdateErrorMessage(error?: { message?: string | null } | null) {
  const message = error?.message?.trim().toLowerCase() ?? "";

  if (message.includes("session") || message.includes("auth session missing")) {
    return getPasswordResetLinkErrorMessage();
  }

  if (message.includes("password should be at least")) {
    return "密码至少需要 8 位。";
  }

  return "暂时无法保存新密码，请稍后再试。";
}

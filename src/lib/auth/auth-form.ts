export function normalizeRedirectTarget(input?: string | null) {
  const value = input?.trim();

  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/workspace";
  }

  return value;
}

export function buildAuthCompletePath(input?: string | null) {
  const safeTarget = normalizeRedirectTarget(input);
  const query = new URLSearchParams({
    next: safeTarget
  });

  return `/auth/complete?${query.toString()}`;
}

export function buildWorkspaceEntryPath(input?: string | null) {
  const safeTarget = normalizeRedirectTarget(input);
  const query = new URLSearchParams({
    next: safeTarget
  });

  return `/workspace-entry?${query.toString()}`;
}

export function buildPostAuthEntryPath(input?: string | null) {
  return buildWorkspaceEntryPath(input);
}

export function buildBillingEntryPath() {
  return "/billing";
}

export function buildLoginRedirectPath(input?: string | null) {
  const safeTarget = normalizeRedirectTarget(input);
  const query = new URLSearchParams({
    redirect: safeTarget
  });

  return `/login?${query.toString()}`;
}

export function validateRegisterInput(input: {
  displayName: string;
  email: string;
  password: string;
  confirmPassword: string;
}) {
  if (!input.displayName.trim()) {
    return "请输入用户名";
  }

  if (!input.email.trim()) {
    return "请输入邮箱地址";
  }

  if (input.password.length < 8) {
    return "密码至少需要 8 位";
  }

  if (input.password !== input.confirmPassword) {
    return "两次输入的密码不一致";
  }

  return null;
}

export function getAuthErrorMessage(
  error: { message?: string | null } | null | undefined,
  action: "login" | "register"
) {
  const message = error?.message?.trim().toLowerCase() ?? "";

  if (message.includes("invalid login credentials")) {
    return "邮箱或密码不正确";
  }

  if (message.includes("email not confirmed")) {
    return "这个邮箱还没有完成注册，请回到注册页重新注册。";
  }

  if (message.includes("user already registered")) {
    return "这个邮箱已经注册过了，请直接登录，或点击“忘记密码”重设密码。";
  }

  if (message.includes("password should be at least")) {
    return "密码至少需要 8 位";
  }

  return action === "login" ? "登录失败，请稍后再试" : "注册失败，请稍后再试";
}

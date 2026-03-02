import { requireCurrentSessionUser } from "@/src/lib/auth/current-user";
import type { SessionUser } from "@/src/types/auth";

type AdminGuardOptions = {
  requireUser?: () => Promise<SessionUser>;
};

export async function requireAdminSession(
  options: AdminGuardOptions = {}
): Promise<SessionUser> {
  const user = await (options.requireUser ?? requireCurrentSessionUser)();

  if (user.role !== "admin") {
    throw new Error("ADMIN_REQUIRED");
  }

  return user;
}

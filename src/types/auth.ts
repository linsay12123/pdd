export type UserRole = "user" | "admin";

export type SessionUser = {
  id: string;
  email: string;
  role: UserRole;
};

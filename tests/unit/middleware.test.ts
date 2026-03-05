import { describe, expect, it } from "vitest";
import {
  isAdminPath,
  isAnonymousApiPath,
  isApiPath,
  isProtectedPath
} from "../../proxy";

describe("isProtectedPath", () => {
  it("marks app routes as protected", () => {
    expect(isProtectedPath("/workspace")).toBe(true);
    expect(isProtectedPath("/tasks")).toBe(true);
    expect(isProtectedPath("/billing")).toBe(true);
    expect(isProtectedPath("/recharge")).toBe(true);
    expect(isProtectedPath("/account")).toBe(true);
    expect(isProtectedPath("/admin")).toBe(true);
  });

  it("leaves public routes open", () => {
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/login")).toBe(false);
  });

  it("marks admin paths separately", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/users")).toBe(true);
    expect(isAdminPath("/workspace")).toBe(false);
  });

  it("marks api paths and anonymous whitelist correctly", () => {
    expect(isApiPath("/api/tasks/create")).toBe(true);
    expect(isApiPath("/workspace")).toBe(false);

    expect(isAnonymousApiPath("/api/health")).toBe(true);
    expect(isAnonymousApiPath("/api/auth/register")).toBe(true);
    expect(isAnonymousApiPath("/api/tasks/create")).toBe(false);
  });
});

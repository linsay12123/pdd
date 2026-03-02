import { describe, expect, it } from "vitest";
import { hasAdminRoleCookie, isAdminPath } from "../../proxy";

describe("admin access", () => {
  it("recognizes admin routes", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/users")).toBe(true);
    expect(isAdminPath("/workspace")).toBe(false);
  });

  it("only treats the admin role cookie as operator access", () => {
    const adminRequest = {
      cookies: {
        get(name: string) {
          if (name === "aw-role") {
            return {
              value: "admin"
            };
          }

          return undefined;
        }
      }
    };
    const userRequest = {
      cookies: {
        get(name: string) {
          if (name === "aw-role") {
            return {
              value: "user"
            };
          }

          return undefined;
        }
      }
    };

    expect(hasAdminRoleCookie(adminRequest as never)).toBe(true);
    expect(hasAdminRoleCookie(userRequest as never)).toBe(false);
  });
});

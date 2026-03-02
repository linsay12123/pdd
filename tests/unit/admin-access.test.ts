import { describe, expect, it } from "vitest";
import { hasSupabaseSessionCookie, isAdminPath } from "../../proxy";

describe("admin access", () => {
  it("recognizes admin routes", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/users")).toBe(true);
    expect(isAdminPath("/workspace")).toBe(false);
  });

  it("recognizes the signed supabase session cookie", () => {
    const signedInRequest = {
      cookies: {
        getAll() {
          return [
            {
              name: "sb-test-auth-token",
              value: "present"
            }
          ];
        }
      }
    };
    const anonymousRequest = {
      cookies: {
        getAll() {
          return [];
        }
      }
    };

    expect(hasSupabaseSessionCookie(signedInRequest as never)).toBe(true);
    expect(hasSupabaseSessionCookie(anonymousRequest as never)).toBe(false);
  });
});

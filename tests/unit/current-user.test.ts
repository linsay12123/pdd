import { describe, expect, it } from "vitest";
import {
  getCurrentSessionUser,
  requireCurrentSessionUser
} from "../../src/lib/auth/current-user";

function createSupabaseStub(options: {
  authUser?: {
    id: string;
    email?: string | null;
  } | null;
  profile?: {
    id: string;
    email: string;
    role: "user" | "admin";
    is_frozen?: boolean;
  } | null;
}) {
  return {
    auth: {
      async getUser() {
        return {
          data: {
            user: options.authUser ?? null
          },
          error: null
        };
      }
    },
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  return {
                    data: options.profile ?? null,
                    error: null
                  };
                }
              };
            }
          };
        }
      };
    }
  };
}

describe("current user helpers", () => {
  it("returns null when there is no auth session", async () => {
    const user = await getCurrentSessionUser({
      supabase: createSupabaseStub({
        authUser: null,
        profile: null
      })
    });

    expect(user).toBeNull();
  });

  it("returns the normalized session user when auth and profile both exist", async () => {
    const user = await getCurrentSessionUser({
      supabase: createSupabaseStub({
        authUser: {
          id: "user-1",
          email: "client@example.com"
        },
        profile: {
          id: "user-1",
          email: "client@example.com",
          role: "admin"
        }
      })
    });

    expect(user).toEqual({
      id: "user-1",
      email: "client@example.com",
      role: "admin"
    });
  });

  it("rejects frozen users in the required helper", async () => {
    await expect(
      requireCurrentSessionUser({
        supabase: createSupabaseStub({
          authUser: {
            id: "user-2",
            email: "frozen@example.com"
          },
          profile: {
            id: "user-2",
            email: "frozen@example.com",
            role: "user",
            is_frozen: true
          }
        })
      })
    ).rejects.toThrow("ACCOUNT_FROZEN");
  });
});

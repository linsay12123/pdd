import { describe, expect, it, vi } from "vitest";
import { handleRegisterRequest } from "../../app/api/auth/register/route";

describe("register route", () => {
  it("creates a directly usable account for a new email", async () => {
    const createUser = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: "user-new",
          email: "new@example.com"
        }
      },
      error: null
    });

    const response = await handleRegisterRequest(
      new Request("https://pindaidai.vercel.app/api/auth/register", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          displayName: "Linsay",
          email: "new@example.com",
          password: "password123"
        })
      }),
      {
        createAdminClient: () => ({}) as never,
        findUserByEmail: vi.fn().mockResolvedValue(null),
        createUser,
        updateUserById: vi.fn(),
        ensureUserBootstrap: vi.fn()
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "new@example.com",
        password: "password123",
        displayName: "Linsay"
      })
    );
    expect(payload.message).toContain("注册成功");
  });

  it("reclaims a stale unconfirmed account for the same email", async () => {
    const updateUserById = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: "user-stale",
          email: "old@example.com"
        }
      },
      error: null
    });

    const response = await handleRegisterRequest(
      new Request("https://pindaidai.vercel.app/api/auth/register", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          displayName: "Linsay",
          email: "old@example.com",
          password: "password123"
        })
      }),
      {
        createAdminClient: () => ({}) as never,
        findUserByEmail: vi.fn().mockResolvedValue({
          id: "user-stale",
          email: "old@example.com",
          email_confirmed_at: null,
          last_sign_in_at: null
        }),
        createUser: vi.fn(),
        updateUserById,
        ensureUserBootstrap: vi.fn()
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(updateUserById).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-stale",
        email: "old@example.com",
        password: "password123",
        displayName: "Linsay"
      })
    );
    expect(payload.message).toContain("注册成功");
  });

  it("tells the user to log in when the email is already in use", async () => {
    const response = await handleRegisterRequest(
      new Request("https://pindaidai.vercel.app/api/auth/register", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          displayName: "Linsay",
          email: "ready@example.com",
          password: "password123"
        })
      }),
      {
        createAdminClient: () => ({}) as never,
        findUserByEmail: vi.fn().mockResolvedValue({
          id: "user-live",
          email: "ready@example.com",
          email_confirmed_at: "2026-03-03T10:00:00.000Z",
          last_sign_in_at: "2026-03-03T10:00:00.000Z"
        }),
        createUser: vi.fn(),
        updateUserById: vi.fn(),
        ensureUserBootstrap: vi.fn()
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.message).toContain("忘记密码");
  });
});

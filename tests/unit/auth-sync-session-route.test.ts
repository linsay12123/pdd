import { describe, expect, it, vi } from "vitest";

describe("auth sync-session route", () => {
  it("returns 400 when access_token or refresh_token is missing", async () => {
    const { handleSyncSessionRequest } = await import("../../app/api/auth/sync-session/route");
    const response = await handleSyncSessionRequest(
      new Request("https://pindaidai.vercel.app/api/auth/sync-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accessToken: "", refreshToken: "" })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.message).toContain("登录状态不完整");
  });

  it("writes the browser session into the server session when tokens are present", async () => {
    const setSession = vi.fn().mockResolvedValue({ error: null });
    const { handleSyncSessionRequest } = await import("../../app/api/auth/sync-session/route");
    const response = await handleSyncSessionRequest(
      new Request("https://pindaidai.vercel.app/api/auth/sync-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accessToken: "access-token", refreshToken: "refresh-token" })
      }),
      {
        createClient: async () => ({ auth: { setSession } }) as never
      }
    );
    const payload = await response.json();

    expect(setSession).toHaveBeenCalledWith({
      access_token: "access-token",
      refresh_token: "refresh-token"
    });
    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true });
  });
});

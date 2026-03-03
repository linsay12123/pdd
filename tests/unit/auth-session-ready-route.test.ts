import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/auth/current-user", () => ({
  getCurrentSessionUserResolution: vi.fn()
}));

describe("auth session-ready route", () => {
  it("returns ready true when the current session is fully ready", async () => {
    const { getCurrentSessionUserResolution } = await import("../../src/lib/auth/current-user");
    vi.mocked(getCurrentSessionUserResolution).mockResolvedValue({
      status: "ready",
      user: {
        id: "user-1",
        email: "user@example.com",
        role: "user"
      }
    });

    const { handleSessionReadyRequest } = await import("../../app/api/auth/session-ready/route");
    const response = await handleSessionReadyRequest();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ready: true, reason: "ready" });
  });

  it("returns ready false when the session is not available yet", async () => {
    const { getCurrentSessionUserResolution } = await import("../../src/lib/auth/current-user");
    vi.mocked(getCurrentSessionUserResolution).mockResolvedValue({
      status: "anonymous"
    });

    const { handleSessionReadyRequest } = await import("../../app/api/auth/session-ready/route");
    const response = await handleSessionReadyRequest();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ready: false, reason: "anonymous" });
  });

  it("auto-bootstraps old accounts when the auth user exists but the profile is missing", async () => {
    const { getCurrentSessionUserResolution } = await import("../../src/lib/auth/current-user");
    const ensureBootstrap = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getCurrentSessionUserResolution)
      .mockResolvedValueOnce({
        status: "profile_missing",
        authUserId: "user-1",
        email: "legacy@example.com"
      })
      .mockResolvedValueOnce({
        status: "ready",
        user: {
          id: "user-1",
          email: "legacy@example.com",
          role: "user"
        }
      });

    const { handleSessionReadyRequest } = await import("../../app/api/auth/session-ready/route");
    const response = await handleSessionReadyRequest({
      ensureBootstrap
    });
    const payload = await response.json();

    expect(ensureBootstrap).toHaveBeenCalledWith({
      authUserId: "user-1",
      email: "legacy@example.com"
    });
    expect(response.status).toBe(200);
    expect(payload).toEqual({ ready: true, reason: "ready" });
  });
});

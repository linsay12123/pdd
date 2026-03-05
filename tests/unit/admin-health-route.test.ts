import { describe, expect, it, vi } from "vitest";
import { handleAdminHealthRequest } from "../../app/api/admin/health/route";

describe("admin health route", () => {
  it("returns full diagnostics for admin", async () => {
    const response = await handleAdminHealthRequest({
      requireAdmin: vi.fn().mockResolvedValue({
        id: "admin-1",
        email: "admin@example.com",
        role: "admin"
      }),
      runDiagnostics: async () => ({
        status: "healthy",
        timestamp: "2026-03-06T01:00:00.000Z",
        httpStatus: 200,
        checks: {
          DB_SCHEMA_COMPAT: {
            ok: true,
            detail: "ok"
          }
        }
      })
    });

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.status).toBe("healthy");
    expect(payload.checks.DB_SCHEMA_COMPAT.ok).toBe(true);
  });

  it("returns 401 when not signed in", async () => {
    const response = await handleAdminHealthRequest({
      requireAdmin: vi.fn().mockRejectedValue(new Error("AUTH_REQUIRED")),
      runDiagnostics: async () => {
        throw new Error("should not run");
      }
    });

    expect(response.status).toBe(401);
  });

  it("returns 403 when current user is not admin", async () => {
    const response = await handleAdminHealthRequest({
      requireAdmin: vi.fn().mockRejectedValue(new Error("ADMIN_REQUIRED")),
      runDiagnostics: async () => {
        throw new Error("should not run");
      }
    });

    expect(response.status).toBe(403);
  });
});

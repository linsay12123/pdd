import { describe, expect, it, vi } from "vitest";
import { handleHealthRequest } from "../../app/api/health/route";

describe("public health route", () => {
  it("returns minimal payload when healthy", async () => {
    const response = await handleHealthRequest({
      runDiagnostics: async () => ({
        status: "healthy",
        timestamp: "2026-03-06T01:00:00.000Z",
        httpStatus: 200,
        checks: {
          INTERNAL_ONLY: {
            ok: true,
            detail: "hidden"
          }
        }
      })
    });

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload).toEqual({
      status: "ok",
      timestamp: "2026-03-06T01:00:00.000Z"
    });
    expect(payload).not.toHaveProperty("checks");
  });

  it("returns degraded without leaking internals when unhealthy", async () => {
    const response = await handleHealthRequest({
      runDiagnostics: async () => ({
        status: "unhealthy",
        timestamp: "2026-03-06T01:00:00.000Z",
        httpStatus: 503,
        checks: {
          INTERNAL_ONLY: {
            ok: false,
            detail: "secret"
          }
        }
      })
    });

    const payload = await response.json();
    expect(response.status).toBe(503);
    expect(payload.status).toBe("degraded");
    expect(payload).not.toHaveProperty("checks");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.fn();
const rpcMock = vi.fn();
const runsListMock = vi.fn();

vi.mock("../../src/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: fromMock,
    rpc: rpcMock
  })
}));

vi.mock("@trigger.dev/sdk/v3", () => ({
  runs: {
    list: runsListMock
  }
}));

describe("health route", () => {
  beforeEach(() => {
    vi.resetModules();
    fromMock.mockReset();
    rpcMock.mockReset();
    runsListMock.mockReset();
    runsListMock.mockResolvedValue({
      data: [
        {
          id: "run-1",
          status: "COMPLETED"
        }
      ],
      nextCursor: undefined
    });

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.OPENAI_API_KEY = "openai-key";
    process.env.UNDETECTABLE_API_KEY = "undetectable-key";
    process.env.TRIGGER_SECRET_KEY = "trigger-key";
  });

  it("reports unhealthy when the database schema is still on the old structure", async () => {
    fromMock.mockImplementation((table: string) => ({
      select: () => ({
        limit: async () => ({
          data: table === "profiles" ? [{ id: "profile-1" }] : [],
          error: null
        })
      })
    }));

    rpcMock.mockResolvedValue({
      data: {
        targetWordCountNullable: false,
        citationStyleNullable: true,
        analysisFieldsReady: true,
        taskFileFieldsReady: true,
        humanizeFieldsReady: true,
        legacyPaymentTablesRemaining: ["pricing_plans"],
        legacyPaymentTypesRemaining: ["payment_provider"],
        legacyTaskStatusesRemaining: ["quota_frozen"]
      },
      error: null
    });

    const { GET } = await import("../../app/api/health/route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.status).toBe("unhealthy");
    expect(payload.checks.DB_SCHEMA_COMPAT.ok).toBe(false);
    expect(payload.checks.DB_SCHEMA_COMPAT.detail).toContain("target_word_count");
    expect(payload.checks.DB_LEGACY_STRUCTURES.ok).toBe(false);
    expect(payload.checks.DB_LEGACY_STRUCTURES.detail).toContain("pricing_plans");
    expect(payload.checks.DB_LEGACY_STRUCTURES.detail).toContain("quota_frozen");
  });

  it("reports healthy only when the new database structure is fully aligned", async () => {
    fromMock.mockImplementation((table: string) => ({
      select: () => ({
        limit: async () => ({
          data: table === "profiles" ? [{ id: "profile-1" }] : [],
          error: null
        })
      })
    }));

    rpcMock.mockResolvedValue({
      data: {
        targetWordCountNullable: true,
        citationStyleNullable: true,
        analysisFieldsReady: true,
        taskFileFieldsReady: true,
        humanizeFieldsReady: true,
        legacyPaymentTablesRemaining: [],
        legacyPaymentTypesRemaining: [],
        legacyTaskStatusesRemaining: []
      },
      error: null
    });

    const { GET } = await import("../../app/api/health/route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status).toBe("healthy");
    expect(payload.checks.DB_SCHEMA_COMPAT.ok).toBe(true);
    expect(payload.checks.DB_LEGACY_STRUCTURES.ok).toBe(true);
  });

  it("reports unhealthy when the Undetectable key is missing, so the route cannot truthfully claim readiness", async () => {
    process.env.UNDETECTABLE_API_KEY = "";

    fromMock.mockImplementation((table: string) => ({
      select: () => ({
        limit: async () => ({
          data: table === "profiles" ? [{ id: "profile-1" }] : [],
          error: null
        })
      })
    }));

    rpcMock.mockResolvedValue({
      data: {
        targetWordCountNullable: true,
        citationStyleNullable: true,
        analysisFieldsReady: true,
        taskFileFieldsReady: true,
        humanizeFieldsReady: true,
        legacyPaymentTablesRemaining: [],
        legacyPaymentTypesRemaining: [],
        legacyTaskStatusesRemaining: []
      },
      error: null
    });

    const { GET } = await import("../../app/api/health/route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.status).toBe("unhealthy");
    expect(payload.checks.UNDETECTABLE_API_KEY.ok).toBe(false);
    expect(payload.checks.UNDETECTABLE_API_KEY.detail).toContain("不可用");
  });

  it("reports unhealthy when the background task secret is missing, so it cannot pretend the async pipeline is ready", async () => {
    process.env.TRIGGER_SECRET_KEY = "";

    fromMock.mockImplementation((table: string) => ({
      select: () => ({
        limit: async () => ({
          data: table === "profiles" ? [{ id: "profile-1" }] : [],
          error: null
        })
      })
    }));

    rpcMock.mockResolvedValue({
      data: {
        targetWordCountNullable: true,
        citationStyleNullable: true,
        analysisFieldsReady: true,
        taskFileFieldsReady: true,
        humanizeFieldsReady: true,
        legacyPaymentTablesRemaining: [],
        legacyPaymentTypesRemaining: [],
        legacyTaskStatusesRemaining: []
      },
      error: null
    });

    const { GET } = await import("../../app/api/health/route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.status).toBe("unhealthy");
    expect(payload.checks.TRIGGER_SECRET_KEY.ok).toBe(false);
    expect(payload.checks.TRIGGER_SECRET_KEY.detail).toContain("后台任务不可用");
  });

  it("reports unhealthy in production when trigger key is a dev key", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.TRIGGER_SECRET_KEY = "tr_dev_example";

    fromMock.mockImplementation((table: string) => ({
      select: () => ({
        limit: async () => ({
          data: table === "profiles" ? [{ id: "profile-1" }] : [],
          error: null
        })
      })
    }));

    rpcMock.mockResolvedValue({
      data: {
        targetWordCountNullable: true,
        citationStyleNullable: true,
        analysisFieldsReady: true,
        taskFileFieldsReady: true,
        humanizeFieldsReady: true,
        legacyPaymentTablesRemaining: [],
        legacyPaymentTypesRemaining: [],
        legacyTaskStatusesRemaining: []
      },
      error: null
    });

    const { GET } = await import("../../app/api/health/route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.status).toBe("unhealthy");
    expect(payload.checks.TRIGGER_SECRET_KEY.ok).toBe(false);
    expect(payload.checks.TRIGGER_SECRET_KEY.detail).toContain("tr_prod");
  });

  it("reports unhealthy when analyze-uploaded-task runtime is still pending version", async () => {
    runsListMock.mockResolvedValue({
      data: [
        {
          id: "run-pending-version",
          status: "PENDING_VERSION"
        }
      ],
      nextCursor: undefined
    });

    fromMock.mockImplementation((table: string) => ({
      select: () => ({
        limit: async () => ({
          data: table === "profiles" ? [{ id: "profile-1" }] : [],
          error: null
        })
      })
    }));

    rpcMock.mockResolvedValue({
      data: {
        targetWordCountNullable: true,
        citationStyleNullable: true,
        analysisFieldsReady: true,
        taskFileFieldsReady: true,
        humanizeFieldsReady: true,
        legacyPaymentTablesRemaining: [],
        legacyPaymentTypesRemaining: [],
        legacyTaskStatusesRemaining: []
      },
      error: null
    });

    const { GET } = await import("../../app/api/health/route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.status).toBe("unhealthy");
    expect(payload.checks.TRIGGER_RUNTIME.ok).toBe(false);
    expect(payload.checks.TRIGGER_RUNTIME.detail).toContain("PENDING_VERSION");
  });
});

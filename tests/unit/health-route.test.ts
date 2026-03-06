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

describe("health diagnostics", () => {
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

    const { runHealthDiagnostics } = await import(
      "../../src/lib/health/diagnostics"
    );
    const diagnostics = await runHealthDiagnostics();

    expect(diagnostics.httpStatus).toBe(503);
    expect(diagnostics.status).toBe("unhealthy");
    expect(diagnostics.checks.DB_SCHEMA_COMPAT.ok).toBe(false);
    expect(diagnostics.checks.DB_SCHEMA_COMPAT.detail).toContain("target_word_count");
    expect(diagnostics.checks.DB_LEGACY_STRUCTURES.ok).toBe(false);
    expect(diagnostics.checks.DB_LEGACY_STRUCTURES.detail).toContain("pricing_plans");
    expect(diagnostics.checks.DB_LEGACY_STRUCTURES.detail).toContain("quota_frozen");
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

    const { runHealthDiagnostics } = await import(
      "../../src/lib/health/diagnostics"
    );
    const diagnostics = await runHealthDiagnostics();

    expect(diagnostics.httpStatus).toBe(200);
    expect(diagnostics.status).toBe("healthy");
    expect(diagnostics.checks.DB_SCHEMA_COMPAT.ok).toBe(true);
    expect(diagnostics.checks.DB_LEGACY_STRUCTURES.ok).toBe(true);
  });

  it("reports unhealthy when recent analyze-uploaded-task runs are all pending_version", async () => {
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

    runsListMock.mockResolvedValue({
      data: [
        {
          id: "run-1",
          status: "PENDING_VERSION"
        },
        {
          id: "run-2",
          status: "PENDING_VERSION"
        }
      ],
      nextCursor: undefined
    });

    const { runHealthDiagnostics } = await import(
      "../../src/lib/health/diagnostics"
    );
    const diagnostics = await runHealthDiagnostics();

    expect(diagnostics.httpStatus).toBe(503);
    expect(diagnostics.checks.TRIGGER_RUNTIME.ok).toBe(true);
    expect(diagnostics.checks.TRIGGER_DEPLOYMENT_READY.ok).toBe(false);
    expect(diagnostics.checks.TRIGGER_DEPLOYMENT_READY.detail).toContain("版本");
  });
});

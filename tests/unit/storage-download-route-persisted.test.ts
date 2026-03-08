import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const downloadMock = vi.fn();
const maybeSingleMock = vi.fn();

vi.mock("server-only", () => ({}));

vi.mock("../../src/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: (table: string) => {
      if (table !== "task_outputs") {
        throw new Error(`unexpected table: ${table}`);
      }

      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: maybeSingleMock
              })
            })
          })
        })
      };
    },
    storage: {
      from: () => ({
        download: downloadMock
      })
    }
  })
}));

describe("storage download route in persisted mode", () => {
  beforeEach(() => {
    vi.resetModules();
    downloadMock.mockReset();
    maybeSingleMock.mockReset();
    vi.useRealTimers();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
  });

  it("downloads task outputs from Supabase storage when persisted mode is enabled", async () => {
    const { saveTaskOutputRecord, resetTaskOutputStore } = await import("../../src/lib/tasks/repository");
    const { createSignedDownloadUrl } = await import("../../src/lib/storage/signed-url");
    const { handleStorageDownloadRequest } = await import("../../app/api/storage/download/route");

    resetTaskOutputStore();
    maybeSingleMock.mockResolvedValue({
      data: {
        id: "out-persisted-1",
        task_id: "task-persisted-1",
        user_id: "user-1",
        output_kind: "final_docx",
        storage_path: "users/user-1/tasks/task-persisted-1/outputs/final.docx",
        is_active: true,
        expires_at: "2099-03-05T09:00:00.000Z",
        created_at: "2026-03-03T10:00:00.000Z"
      },
      error: null
    });
    downloadMock.mockResolvedValue({
      data: new Blob(["persisted-final-doc"]),
      error: null
    });

    const output = saveTaskOutputRecord({
      id: "out-persisted-1",
      taskId: "task-persisted-1",
      userId: "user-1",
      outputKind: "final_docx",
      storagePath: "users/user-1/tasks/task-persisted-1/outputs/final.docx",
      expiresAt: "2099-03-05T09:00:00.000Z"
    });

    const signedUrl = createSignedDownloadUrl({
      output,
      userId: "user-1"
    });

    const response = await handleStorageDownloadRequest(
      new Request(`http://localhost${signedUrl}`),
      {
        requireUser: async () => ({
          id: "user-1",
          email: "user-1@example.com",
          role: "user"
        })
      }
    );

    expect(downloadMock).toHaveBeenCalledWith(
      "users/user-1/tasks/task-persisted-1/outputs/final.docx"
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("persisted-final-doc");
  });

  it("keeps signed urls stable for legacy rows whose expires_at is still null", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-03T10:00:00.000Z"));

    const { saveTaskOutputRecord, resetTaskOutputStore } = await import("../../src/lib/tasks/repository");
    const { createSignedDownloadUrl } = await import("../../src/lib/storage/signed-url");
    const { handleStorageDownloadRequest } = await import("../../app/api/storage/download/route");

    resetTaskOutputStore();
    maybeSingleMock.mockResolvedValue({
      data: {
        id: "out-persisted-null-expiry",
        task_id: "task-persisted-null-expiry",
        user_id: "user-1",
        output_kind: "reference_report_pdf",
        storage_path: "users/user-1/tasks/task-persisted-null-expiry/outputs/reference-report.pdf",
        is_active: true,
        expires_at: null,
        created_at: "2026-03-03T10:00:00.000Z"
      },
      error: null
    });
    downloadMock.mockResolvedValue({
      data: new Blob(["persisted-reference-report"]),
      error: null
    });

    const output = saveTaskOutputRecord({
      id: "out-persisted-null-expiry",
      taskId: "task-persisted-null-expiry",
      userId: "user-1",
      outputKind: "reference_report_pdf",
      storagePath: "users/user-1/tasks/task-persisted-null-expiry/outputs/reference-report.pdf",
      createdAt: "2026-03-03T10:00:00.000Z"
    });

    const signedUrl = createSignedDownloadUrl({
      output,
      userId: "user-1"
    });

    vi.setSystemTime(new Date("2026-03-03T10:05:00.000Z"));

    const response = await handleStorageDownloadRequest(
      new Request(`http://localhost${signedUrl}`),
      {
        requireUser: async () => ({
          id: "user-1",
          email: "user-1@example.com",
          role: "user"
        })
      }
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("persisted-reference-report");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const uploadMock = vi.fn();
const downloadMock = vi.fn();
const testEnv = process.env as Record<string, string | undefined>;

vi.mock("../../src/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    storage: {
      from: () => ({
        upload: uploadMock,
        download: downloadMock
      })
    }
  })
}));

describe("task artifact storage", () => {
  beforeEach(() => {
    vi.resetModules();
    uploadMock.mockReset();
    downloadMock.mockReset();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    testEnv.NODE_ENV = "test";
  });

  it("uploads artifacts to Supabase storage when the project runs in persisted mode", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    uploadMock.mockResolvedValue({
      error: null
    });

    const { saveTaskArtifact } = await import("../../src/lib/storage/task-artifacts");

    await saveTaskArtifact({
      storagePath: "users/user-1/tasks/task-1/outputs/final.docx",
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      body: Buffer.from("docx-content", "utf8")
    });

    expect(uploadMock).toHaveBeenCalledWith(
      "users/user-1/tasks/task-1/outputs/final.docx",
      expect.any(Buffer),
      expect.objectContaining({
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true
      })
    );
  });

  it("downloads artifacts from Supabase storage when the project runs in persisted mode", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    downloadMock.mockResolvedValue({
      data: new Blob(["report-bytes"]),
      error: null
    });

    const { readTaskArtifact } = await import("../../src/lib/storage/task-artifacts");

    const result = await readTaskArtifact({
      storagePath: "users/user-1/tasks/task-1/outputs/reference-report.pdf"
    });

    expect(downloadMock).toHaveBeenCalledWith(
      "users/user-1/tasks/task-1/outputs/reference-report.pdf"
    );
    expect(result.toString("utf8")).toBe("report-bytes");
  });

  it("does not silently fall back to local disk when formal runtime has no real storage configured", async () => {
    const originalNodeEnv = testEnv.NODE_ENV;

    testEnv.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";

    const { saveTaskArtifact, readTaskArtifact } = await import(
      "../../src/lib/storage/task-artifacts"
    );

    await expect(
      saveTaskArtifact({
        storagePath: "users/user-1/tasks/task-1/outputs/final.docx",
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        body: Buffer.from("docx-content", "utf8")
      })
    ).rejects.toThrow("REAL_ARTIFACT_STORAGE_REQUIRED");

    await expect(
      readTaskArtifact({
        storagePath: "users/user-1/tasks/task-1/outputs/final.docx"
      })
    ).rejects.toThrow("REAL_ARTIFACT_STORAGE_REQUIRED");

    testEnv.NODE_ENV = originalNodeEnv;
  });
});

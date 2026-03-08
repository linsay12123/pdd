import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const uploadMock = vi.fn();
const deactivateMock = vi.fn();
const insertSelectSingleMock = vi.fn();
const spawnMock = vi.fn(() => {
  throw new Error("spawn should not be called");
});

vi.mock("server-only", () => ({}));

vi.mock("node:child_process", () => ({
  spawn: spawnMock
}));

vi.mock("../../src/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: (table: string) => {
      if (table !== "task_outputs") {
        throw new Error(`unexpected table: ${table}`);
      }

      const updateChain: {
        eq: (column: string) => typeof updateChain | Promise<{ error: null }>;
      } = {
        eq: () => updateChain
      };
      updateChain.eq = (column: string) => {
        if (column === "is_active") {
          return deactivateMock() as Promise<{ error: null }>;
        }

        return updateChain;
      };

      return {
        update: () => updateChain,
        insert: () => ({
          select: () => ({
            single: insertSelectSingleMock
          })
        })
      };
    },
    storage: {
      from: () => ({
        upload: uploadMock
      })
    }
  })
}));

describe("deliverables export in /var/task style runtime", () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    uploadMock.mockReset();
    deactivateMock.mockReset();
    insertSelectSingleMock.mockReset();
    spawnMock.mockClear();

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";

    uploadMock.mockResolvedValue({ error: null });
    deactivateMock.mockResolvedValue({ error: null });
    insertSelectSingleMock.mockResolvedValue({
      data: {
        id: "out-1",
        task_id: "task-id",
        user_id: "user-1",
        output_kind: "final_docx",
        storage_path: "users/user-1/tasks/task-id/outputs/final.docx",
        is_active: true,
        expires_at: null,
        created_at: "2026-03-03T10:00:00.000Z"
      },
      error: null
    });

    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue("/var/task");
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
  });

  it("exports docx without touching /var/task/tmp or spawning python", async () => {
    const { exportDocx } = await import("../../src/lib/deliverables/export-docx");

    const result = await exportDocx({
      taskId: "task-docx-runtime-temp",
      userId: "user-1",
      title: "Sustainable Finance",
      sections: [
        {
          heading: "Introduction",
          paragraphs: ["Paragraph one."]
        }
      ],
      references: ["Smith, A. (2024). Source."],
      citationStyle: "APA 7"
    });

    expect(result.outputPath).toBe("users/user-1/tasks/task-docx-runtime-temp/outputs/final.docx");
    expect(spawnMock).not.toHaveBeenCalled();
    expect(uploadMock).toHaveBeenCalledWith(
      "users/user-1/tasks/task-docx-runtime-temp/outputs/final.docx",
      expect.any(Buffer),
      expect.objectContaining({ upsert: true })
    );
  });

  it("exports reference report without touching /var/task/tmp or spawning python", async () => {
    insertSelectSingleMock.mockResolvedValueOnce({
      data: {
        id: "out-2",
        task_id: "task-report-runtime-temp",
        user_id: "user-1",
        output_kind: "reference_report_pdf",
        storage_path: "users/user-1/tasks/task-report-runtime-temp/outputs/reference-report.pdf",
        is_active: true,
        expires_at: null,
        created_at: "2026-03-03T10:00:00.000Z"
      },
      error: null
    });

    const { exportReferenceReport } = await import("../../src/lib/deliverables/export-report");

    const result = await exportReferenceReport({
      taskId: "task-report-runtime-temp",
      userId: "user-1",
      reportId: "REF-001",
      createdAt: "2026-03-02T10:00:00.000Z",
      taskSummary: {
        targetWordCount: 2000,
        citationStyle: "APA 7"
      },
      entries: [
        {
          rawReference: "Smith, A. (2024). Source.",
          verdict: "matching",
          reasoning: "Title and metadata align."
        }
      ],
      closingSummary: "Most references look usable."
    });

    expect(result.outputPath).toBe(
      "users/user-1/tasks/task-report-runtime-temp/outputs/reference-report.pdf"
    );
    expect(spawnMock).not.toHaveBeenCalled();
    expect(uploadMock).toHaveBeenCalledWith(
      "users/user-1/tasks/task-report-runtime-temp/outputs/reference-report.pdf",
      expect.any(Buffer),
      expect.objectContaining({ upsert: true })
    );
  });
});

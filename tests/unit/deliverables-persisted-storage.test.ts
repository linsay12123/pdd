import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const uploadMock = vi.fn();
const deactivateMock = vi.fn();
const insertSelectSingleMock = vi.fn();

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

describe("deliverables persisted storage", () => {
  beforeEach(() => {
    vi.resetModules();
    uploadMock.mockReset();
    deactivateMock.mockReset();
    insertSelectSingleMock.mockReset();
    uploadMock.mockResolvedValue({
      error: null
    });
    deactivateMock.mockResolvedValue({
      error: null
    });
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
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
  });

  it("uploads final docx files through task artifact storage in persisted mode", async () => {
    const { exportDocx } = await import("../../src/lib/deliverables/export-docx");

    await exportDocx({
      taskId: "task-docx-persisted",
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

    expect(uploadMock).toHaveBeenCalledWith(
      "users/user-1/tasks/task-docx-persisted/outputs/final.docx",
      expect.any(Buffer),
      expect.objectContaining({
        upsert: true
      })
    );
  });

  it("uploads reference reports through task artifact storage in persisted mode", async () => {
    const { exportReferenceReport } = await import("../../src/lib/deliverables/export-report");
    insertSelectSingleMock.mockResolvedValueOnce({
      data: {
        id: "out-2",
        task_id: "task-report-persisted",
        user_id: "user-1",
        output_kind: "reference_report_pdf",
        storage_path: "users/user-1/tasks/task-report-persisted/outputs/reference-report.pdf",
        is_active: true,
        expires_at: null,
        created_at: "2026-03-03T10:00:00.000Z"
      },
      error: null
    });

    await exportReferenceReport({
      taskId: "task-report-persisted",
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

    expect(uploadMock).toHaveBeenCalledWith(
      "users/user-1/tasks/task-report-persisted/outputs/reference-report.pdf",
      expect.any(Buffer),
      expect.objectContaining({
        upsert: true
      })
    );
  });
});

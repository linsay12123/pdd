import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractTextFromUpload } from "../../src/lib/files/extract-text";

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

describe("deliverables export without local python", () => {
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
  });

  it("exports docx without spawning python3", async () => {
    const { exportDocx } = await import("../../src/lib/deliverables/export-docx");

    await expect(
      exportDocx({
        taskId: "task-docx-no-python",
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
      })
    ).resolves.toEqual(
      expect.objectContaining({
        outputPath: "users/user-1/tasks/task-docx-no-python/outputs/final.docx",
        storagePath: "users/user-1/tasks/task-docx-no-python/outputs/final.docx"
      })
    );

    expect(spawnMock).not.toHaveBeenCalled();
    expect(uploadMock).toHaveBeenCalledWith(
      "users/user-1/tasks/task-docx-no-python/outputs/final.docx",
      expect.any(Buffer),
      expect.objectContaining({ upsert: true })
    );
  });

  it("writes eastAsia font mapping into the exported docx", async () => {
    const { exportDocx } = await import("../../src/lib/deliverables/export-docx");

    await exportDocx({
      taskId: "task-docx-font-map",
      userId: "user-1",
      title: "中文标题 Chinese Title",
      sections: [
        {
          heading: "第一章 Introduction",
          paragraphs: ["这里有中文内容，也有 English content."]
        }
      ],
      references: ["张三. (2024). 中文参考文献."],
      citationStyle: "APA 7"
    });

    const uploadedBuffer = uploadMock.mock.calls.at(-1)?.[1];
    expect(uploadedBuffer).toBeInstanceOf(Buffer);

    const zip = await JSZip.loadAsync(uploadedBuffer as Buffer);
    const documentXml = await zip.file("word/document.xml")?.async("text");

    expect(documentXml).toContain("中文标题 Chinese Title");
    expect(documentXml).toContain('w:eastAsia="SimSun"');
  });

  it("exports reference report without spawning python3", async () => {
    insertSelectSingleMock.mockResolvedValueOnce({
      data: {
        id: "out-2",
        task_id: "task-report-no-python",
        user_id: "user-1",
        output_kind: "reference_report_pdf",
        storage_path: "users/user-1/tasks/task-report-no-python/outputs/reference-report.pdf",
        is_active: true,
        expires_at: null,
        created_at: "2026-03-03T10:00:00.000Z"
      },
      error: null
    });

    const { exportReferenceReport } = await import("../../src/lib/deliverables/export-report");

    await expect(
      exportReferenceReport({
        taskId: "task-report-no-python",
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
      })
    ).resolves.toEqual(
      expect.objectContaining({
        outputPath: "users/user-1/tasks/task-report-no-python/outputs/reference-report.pdf",
        storagePath: "users/user-1/tasks/task-report-no-python/outputs/reference-report.pdf"
      })
    );

    expect(spawnMock).not.toHaveBeenCalled();
    expect(uploadMock).toHaveBeenCalledWith(
      "users/user-1/tasks/task-report-no-python/outputs/reference-report.pdf",
      expect.any(Buffer),
      expect.objectContaining({ upsert: true })
    );
  });

  it("exports a chinese reference report that stays readable", async () => {
    insertSelectSingleMock.mockResolvedValueOnce({
      data: {
        id: "out-3",
        task_id: "task-report-chinese",
        user_id: "user-1",
        output_kind: "reference_report_pdf",
        storage_path: "users/user-1/tasks/task-report-chinese/outputs/reference-report.pdf",
        is_active: true,
        expires_at: null,
        created_at: "2026-03-03T10:00:00.000Z"
      },
      error: null
    });

    const { exportReferenceReport } = await import("../../src/lib/deliverables/export-report");

    await exportReferenceReport({
      taskId: "task-report-chinese",
      userId: "user-1",
      reportId: "REF-002",
      createdAt: "2026-03-02T10:00:00.000Z",
      taskSummary: {
        targetWordCount: 1000,
        citationStyle: "APA 7"
      },
      entries: [
        {
          rawReference: "张三. (2024). 中文参考文献.",
          verdict: "matching",
          reasoning: "这条参考文献和正文观点基本可对应。"
        }
      ],
      closingSummary: "整体看起来风险较低。"
    });

    const uploadedBuffer = uploadMock.mock.calls.at(-1)?.[1];
    expect(uploadedBuffer).toBeInstanceOf(Buffer);
    const pdfBytes = Uint8Array.from(uploadedBuffer as Buffer);

    const text = await extractTextFromUpload(
      new File([pdfBytes], "reference-report.pdf", {
        type: "application/pdf"
      })
    );

    expect(text).toContain("参考文献核验报告");
    expect(text).toContain("基本可对应");
    expect(text).toContain("这条参考文献和正文观点基本可对应");
  });
});

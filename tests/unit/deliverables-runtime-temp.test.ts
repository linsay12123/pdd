import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  spawnMock,
  uploadMock,
  deactivateMock,
  insertSelectSingleMock
} = vi.hoisted(() => ({
  spawnMock: vi.fn(),
  uploadMock: vi.fn(),
  deactivateMock: vi.fn(),
  insertSelectSingleMock: vi.fn()
}));

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

describe("deliverables runtime temp directories", () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    spawnMock.mockReset();
    uploadMock.mockReset();
    deactivateMock.mockReset();
    insertSelectSingleMock.mockReset();

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

    spawnMock.mockImplementation((_command: string, args: string[]) => {
      const child = new EventEmitter() as EventEmitter & {
        on: (event: string, listener: (...input: unknown[]) => void) => typeof child;
      };

      void (async () => {
        const outputPath = args[2];
        await mkdir(path.dirname(outputPath), { recursive: true });
        await writeFile(outputPath, "generated-output", "utf8");
        child.emit("exit", 0);
      })();

      return child;
    });
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
  });

  it("exports docx using os.tmpdir even when process.cwd points at /var/task", async () => {
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

    const [_scriptPath, payloadPath, outputPath] = spawnMock.mock.calls[0][1] as string[];

    expect(payloadPath.startsWith(os.tmpdir())).toBe(true);
    expect(outputPath.startsWith(os.tmpdir())).toBe(true);
    expect(payloadPath).not.toContain("/var/task/tmp");
    expect(outputPath).not.toContain("/var/task/storage");
    expect(existsSync(payloadPath)).toBe(false);
    expect(uploadMock).toHaveBeenCalledWith(
      "users/user-1/tasks/task-docx-runtime-temp/outputs/final.docx",
      expect.any(Buffer),
      expect.objectContaining({ upsert: true })
    );
  });

  it("exports reference reports using os.tmpdir even when process.cwd points at /var/task", async () => {
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
          verdictLabel: "基本可对应",
          reasoning: "Title and metadata align."
        }
      ],
      closingSummary: "Most references look usable."
    });

    const [_scriptPath, payloadPath, outputPath] = spawnMock.mock.calls[0][1] as string[];

    expect(payloadPath.startsWith(os.tmpdir())).toBe(true);
    expect(outputPath.startsWith(os.tmpdir())).toBe(true);
    expect(payloadPath).not.toContain("/var/task/tmp");
    expect(outputPath).not.toContain("/var/task/storage");
    expect(existsSync(payloadPath)).toBe(false);
    expect(uploadMock).toHaveBeenCalledWith(
      "users/user-1/tasks/task-report-runtime-temp/outputs/reference-report.pdf",
      expect.any(Buffer),
      expect.objectContaining({ upsert: true })
    );
  });

  it("rejects cleanly when the docx worker cannot start", async () => {
    let payloadPath = "";
    let outputPath = "";

    spawnMock.mockImplementation((_command: string, args: string[]) => {
      const child = new EventEmitter() as EventEmitter & {
        on: (event: string, listener: (...input: unknown[]) => void) => typeof child;
      };

      [, payloadPath, outputPath] = args;
      queueMicrotask(() => {
        child.emit("error", new Error("spawn ENOENT"));
      });

      return child;
    });

    const { exportDocx } = await import("../../src/lib/deliverables/export-docx");

    await expect(
      exportDocx({
        taskId: "task-docx-start-fail",
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
    ).rejects.toThrow("Python worker failed to start: spawn ENOENT");

    expect(uploadMock).not.toHaveBeenCalled();
    expect(insertSelectSingleMock).not.toHaveBeenCalled();
    expect(existsSync(path.dirname(payloadPath))).toBe(false);
    expect(existsSync(outputPath)).toBe(false);
  });

  it("cleans up temp files when the reference report worker exits with an error", async () => {
    let payloadPath = "";
    let outputPath = "";

    spawnMock.mockImplementation((_command: string, args: string[]) => {
      const child = new EventEmitter() as EventEmitter & {
        on: (event: string, listener: (...input: unknown[]) => void) => typeof child;
      };

      [, payloadPath, outputPath] = args;
      queueMicrotask(() => {
        child.emit("exit", 2);
      });

      return child;
    });

    const { exportReferenceReport } = await import("../../src/lib/deliverables/export-report");

    await expect(
      exportReferenceReport({
        taskId: "task-report-exit-fail",
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
            verdictLabel: "基本可对应",
            reasoning: "Title and metadata align."
          }
        ],
        closingSummary: "Most references look usable."
      })
    ).rejects.toThrow("Python worker failed with exit code 2");

    expect(uploadMock).not.toHaveBeenCalled();
    expect(insertSelectSingleMock).not.toHaveBeenCalled();
    expect(existsSync(path.dirname(payloadPath))).toBe(false);
    expect(existsSync(outputPath)).toBe(false);
  });
});

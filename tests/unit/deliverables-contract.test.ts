import { describe, expect, it } from "vitest";
import {
  exportDocx,
  prepareDocxExportPayload,
  resolveDocxOutputPath
} from "../../src/lib/deliverables/export-docx";
import {
  exportReferenceReport,
  prepareReferenceReportPayload,
  resolveReferenceReportOutputPath
} from "../../src/lib/deliverables/export-report";
import { getTaskOutputs, resetTaskOutputStore } from "../../src/lib/tasks/repository";

describe("docx export contract", () => {
  it("requires the fields needed to generate the final article docx", () => {
    const payload = prepareDocxExportPayload({
      taskId: "task-1",
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

    expect(payload.title).toBe("Sustainable Finance");
    expect(payload.sections).toHaveLength(1);
    expect(payload.references).toHaveLength(1);
    expect(resolveDocxOutputPath("user-1", "task-1")).toContain(
      "storage/users/user-1/tasks/task-1/outputs/final.docx"
    );
  });

  it("rejects an export with no title or no references", () => {
    expect(() =>
      prepareDocxExportPayload({
        taskId: "task-1",
        userId: "user-1",
        title: "",
        sections: [],
        references: [],
        citationStyle: "APA 7"
      })
    ).toThrow("DOCX export requires");
  });

  it("records the exported docx as a task output", async () => {
    resetTaskOutputStore();

    const result = await exportDocx({
      taskId: "task-docx-export",
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

    expect(result.outputPath).toContain(
      "storage/users/user-1/tasks/task-docx-export/outputs/final.docx"
    );
    expect(getTaskOutputs("task-docx-export")).toEqual([
      expect.objectContaining({
        outputKind: "final_docx",
        storagePath: "users/user-1/tasks/task-docx-export/outputs/final.docx"
      })
    ]);
  });
});

describe("pdf report export contract", () => {
  it("requires the fields needed to generate the reference report", () => {
    const payload = prepareReferenceReportPayload({
      taskId: "task-1",
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

    expect(payload.entries).toHaveLength(1);
    expect(resolveReferenceReportOutputPath("user-1", "task-1")).toContain(
      "storage/users/user-1/tasks/task-1/outputs/reference-report.pdf"
    );
  });

  it("rejects an export with no report rows", () => {
    expect(() =>
      prepareReferenceReportPayload({
        taskId: "task-1",
        userId: "user-1",
        reportId: "REF-001",
        createdAt: "2026-03-02T10:00:00.000Z",
        taskSummary: {
          targetWordCount: 2000,
          citationStyle: "APA 7"
        },
        entries: [],
        closingSummary: "None."
      })
    ).toThrow("Reference report export requires");
  });

  it("records the exported pdf report as a task output", async () => {
    resetTaskOutputStore();

    const result = await exportReferenceReport({
      taskId: "task-report-export",
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

    expect(result.outputPath).toContain(
      "storage/users/user-1/tasks/task-report-export/outputs/reference-report.pdf"
    );
    expect(getTaskOutputs("task-report-export")).toEqual([
      expect.objectContaining({
        outputKind: "reference_report_pdf",
        storagePath: "users/user-1/tasks/task-report-export/outputs/reference-report.pdf"
      })
    ]);
  });
});

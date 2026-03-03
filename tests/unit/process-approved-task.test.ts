import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { saveTaskOutlineVersion, saveTaskOutputRecord, saveTaskSummary } from "../../src/lib/tasks/repository";
import {
  listTaskDraftVersions,
  listTaskReferenceChecks,
  getTaskOutputs,
  resetTaskDraftStore,
  resetTaskFileStore,
  resetTaskOutlineStore,
  resetTaskOutputStore,
  resetTaskReferenceCheckStore,
  resetTaskStore
} from "../../src/lib/tasks/repository";
import { processApprovedTask } from "../../src/lib/tasks/process-approved-task";

describe("process approved task", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    resetTaskStore();
    resetTaskFileStore();
    resetTaskOutlineStore();
    resetTaskDraftStore();
    resetTaskReferenceCheckStore();
    resetTaskOutputStore();
  });

  it("turns an approved outline into a draft, reference checks, and deliverables", async () => {
    saveTaskSummary({
      id: "task-process-1",
      userId: "user-1",
      status: "drafting",
      targetWordCount: 2000,
      citationStyle: "APA 7",
      specialRequirements: "Use a formal academic tone.",
      latestOutlineVersionId: "outline-1"
    });
    saveTaskOutlineVersion({
      id: "outline-1",
      taskId: "task-process-1",
      userId: "user-1",
      versionNumber: 1,
      outline: {
        articleTitle: "Sustainable Finance and Policy",
        targetWordCount: 2000,
        citationStyle: "APA 7",
        chineseMirrorPending: true,
        sections: [
          {
            title: "Introduction",
            summary: "Explain the topic and central claim.",
            bulletPoints: ["Context", "Thesis", "Scope"]
          },
          {
            title: "Analysis",
            summary: "Examine policy and finance links.",
            bulletPoints: ["Evidence", "Counterpoint", "Implications"]
          }
        ]
      },
      feedback: "",
      isApproved: true,
      targetWordCount: 2000,
      citationStyle: "APA 7"
    });

    const result = await processApprovedTask(
      {
        taskId: "task-process-1",
        userId: "user-1",
        safetyIdentifier: "pdd_test_user"
      },
      {
        generateDraft: async () => ({
          prompt: "draft prompt",
          draft: [
            "# Sustainable Finance and Policy",
            "",
            "## Introduction",
            "",
            "A short opening paragraph.",
            "",
            "## Analysis",
            "",
            "A short analysis paragraph.",
            "",
            "## References",
            "",
            "Smith, A. (2024). Sustainable finance and policy."
          ].join("\n")
        }),
        rewriteDraftToTarget: async () => ({
          prompt: "adjust prompt",
          candidateDraft: [
            "# Sustainable Finance and Policy",
            "",
            "## Introduction",
            "",
            "A longer opening paragraph with more evidence and more explanation.",
            "",
            "## Analysis",
            "",
            "A longer analysis paragraph with clearer evaluation and stronger examples.",
            "",
            "## References",
            "",
            "Smith, A. (2024). Sustainable finance and policy."
          ].join("\n")
        }),
        verifyReferences: async () => [
          {
            rawReference: "Smith, A. (2024). Sustainable finance and policy.",
            verdict: "matching" as const,
            reasoning: "The title and year line up with the claim.",
            prompt: "verify prompt"
          }
        ],
        exportDocx: async ({ taskId, userId }) => {
          const output = saveTaskOutputRecord({
            taskId,
            userId,
            outputKind: "final_docx",
            storagePath: `users/${userId}/tasks/${taskId}/outputs/final.docx`
          });

          return {
            outputPath: output.storagePath,
            payloadPath: `/tmp/${taskId}-final.json`
          };
        },
        exportReferenceReport: async ({ taskId, userId }) => {
          const output = saveTaskOutputRecord({
            taskId,
            userId,
            outputKind: "reference_report_pdf",
            storagePath: `users/${userId}/tasks/${taskId}/outputs/reference-report.pdf`
          });

          return {
            outputPath: output.storagePath,
            payloadPath: `/tmp/${taskId}-report.json`
          };
        }
      }
    );

    expect(result.task.status).toBe("deliverable_ready");
    expect(listTaskDraftVersions("task-process-1")).toHaveLength(3);
    expect(listTaskReferenceChecks("task-process-1")).toHaveLength(1);
    expect(getTaskOutputs("task-process-1")).toHaveLength(2);
    expect(result.downloads.finalDocxOutputId).toBeTruthy();
    expect(result.downloads.referenceReportOutputId).toBeTruthy();
  });
});

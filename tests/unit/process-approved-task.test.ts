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
import {
  processApprovedTask,
  TaskProcessingStageError
} from "../../src/lib/tasks/process-approved-task";

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

  it("turns an approved outline into a draft, reference checks, and exported files before final settlement", async () => {
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
            Array.from({ length: 1000 }, (_, index) => `intro${index}`).join(" "),
            "",
            "## Analysis",
            "",
            Array.from({ length: 1000 }, (_, index) => `analysis${index}`).join(" "),
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
            outputId: output.id,
            outputPath: output.storagePath,
            storagePath: output.storagePath
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
            outputId: output.id,
            outputPath: output.storagePath,
            storagePath: output.storagePath
          };
        }
      }
    );

    expect(result.task.status).toBe("exporting");
    expect(listTaskDraftVersions("task-process-1")).toHaveLength(3);
    expect(listTaskReferenceChecks("task-process-1")).toHaveLength(1);
    expect(getTaskOutputs("task-process-1")).toHaveLength(2);
    expect(result.downloads.finalDocxOutputId).toBeTruthy();
    expect(result.downloads.referenceReportOutputId).toBeTruthy();
  });

  it("keeps rewriting until the body word count lands within plus or minus 10 words", async () => {
    saveTaskSummary({
      id: "task-process-tight-word-count",
      userId: "user-1",
      status: "drafting",
      targetWordCount: 1000,
      citationStyle: "APA 7",
      specialRequirements: "Use a formal academic tone.",
      latestOutlineVersionId: "outline-tight-word-count"
    });
    saveTaskOutlineVersion({
      id: "outline-tight-word-count",
      taskId: "task-process-tight-word-count",
      userId: "user-1",
      versionNumber: 1,
      outline: {
        articleTitle: "Energy Transition and Policy",
        targetWordCount: 1000,
        citationStyle: "APA 7",
        chineseMirrorPending: true,
        sections: [
          {
            title: "Introduction",
            summary: "Explain the research problem.",
            bulletPoints: ["Context", "Gap", "Claim"]
          },
          {
            title: "Discussion",
            summary: "Analyse the core argument.",
            bulletPoints: ["Evidence", "Counterargument", "Judgement"]
          },
          {
            title: "Conclusion",
            summary: "Close the argument clearly.",
            bulletPoints: ["Findings", "Implications", "Limits"]
          }
        ]
      },
      feedback: "",
      isApproved: true,
      targetWordCount: 1000,
      citationStyle: "APA 7"
    });

    const rewriteDraftToTarget = vi
      .fn()
      .mockResolvedValueOnce({
        prompt: "adjust prompt 1",
        candidateDraft: [
          "# Energy Transition and Policy",
          "",
          "## Introduction",
          "",
          Array.from({ length: 420 }, (_, index) => `intro${index}`).join(" "),
          "",
          "## Discussion",
          "",
          Array.from({ length: 450 }, (_, index) => `body${index}`).join(" "),
          "",
          "## Conclusion",
          "",
          Array.from({ length: 517 }, (_, index) => `end${index}`).join(" "),
          "",
          "## References",
          "",
          "Lee, A. (2024). Energy transition governance. https://example.com/source"
        ].join("\n")
      })
      .mockResolvedValueOnce({
        prompt: "adjust prompt 2",
        candidateDraft: [
          "# Energy Transition and Policy",
          "",
          "## Introduction",
          "",
          Array.from({ length: 330 }, (_, index) => `intro${index}`).join(" "),
          "",
          "## Discussion",
          "",
          Array.from({ length: 340 }, (_, index) => `body${index}`).join(" "),
          "",
          "## Conclusion",
          "",
          Array.from({ length: 334 }, (_, index) => `end${index}`).join(" "),
          "",
          "## References",
          "",
          "Lee, A. (2024). Energy transition governance. https://example.com/source"
        ].join("\n")
      });

    const result = await processApprovedTask(
      {
        taskId: "task-process-tight-word-count",
        userId: "user-1",
        safetyIdentifier: "pdd_test_user"
      },
      {
        generateDraft: async () => ({
          prompt: "draft prompt",
          draft: [
            "# Energy Transition and Policy",
            "",
            "## Introduction",
            "",
            Array.from({ length: 700 }, (_, index) => `intro${index}`).join(" "),
            "",
            "## Discussion",
            "",
            Array.from({ length: 800 }, (_, index) => `body${index}`).join(" "),
            "",
            "## Conclusion",
            "",
            Array.from({ length: 706 }, (_, index) => `end${index}`).join(" "),
            "",
            "## References",
            "",
            "Lee, A. (2024). Energy transition governance. https://example.com/source"
          ].join("\n")
        }),
        rewriteDraftToTarget,
        verifyReferences: async () => [
          {
            rawReference: "Lee, A. (2024). Energy transition governance. https://example.com/source",
            verdict: "matching" as const,
            reasoning: "The title and link line up with the draft.",
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
            outputId: output.id,
            outputPath: output.storagePath,
            storagePath: output.storagePath
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
            outputId: output.id,
            outputPath: output.storagePath,
            storagePath: output.storagePath
          };
        }
      }
    );

    expect(rewriteDraftToTarget).toHaveBeenCalledTimes(2);
    expect(result.finalDraftMarkdown).toContain("intro329");
    expect(listTaskDraftVersions("task-process-tight-word-count").at(-1)?.bodyWordCount).toBe(1004);
    expect(listTaskDraftVersions("task-process-tight-word-count").filter((draft) => draft.isActive)).toHaveLength(2);
  });

  it("fails at the word-count stage after 20 unsuccessful rewrites", async () => {
    saveTaskSummary({
      id: "task-process-word-count-fails",
      userId: "user-1",
      status: "drafting",
      targetWordCount: 1000,
      citationStyle: "APA 7",
      specialRequirements: "",
      latestOutlineVersionId: "outline-word-count-fails"
    });
    saveTaskOutlineVersion({
      id: "outline-word-count-fails",
      taskId: "task-process-word-count-fails",
      userId: "user-1",
      versionNumber: 1,
      outline: {
        articleTitle: "Climate Governance",
        targetWordCount: 1000,
        citationStyle: "APA 7",
        chineseMirrorPending: true,
        sections: [
          {
            title: "Intro",
            summary: "Intro",
            bulletPoints: ["a", "b", "c"]
          }
        ]
      },
      feedback: "",
      isApproved: true,
      targetWordCount: 1000,
      citationStyle: "APA 7"
    });

    const rewriteDraftToTarget = vi.fn(async () => ({
      prompt: "adjust prompt",
      candidateDraft: [
        "# Climate Governance",
        "",
        "## Intro",
        "",
        Array.from({ length: 1200 }, (_, index) => `body${index}`).join(" "),
        "",
        "## References",
        "",
        "Ng, P. (2024). Climate governance. https://example.com/source"
      ].join("\n")
    }));

    await expect(
      processApprovedTask(
        {
          taskId: "task-process-word-count-fails",
          userId: "user-1",
          safetyIdentifier: "pdd_test_user"
        },
        {
          generateDraft: async () => ({
            prompt: "draft prompt",
            draft: [
              "# Climate Governance",
              "",
              "## Intro",
              "",
              Array.from({ length: 1500 }, (_, index) => `body${index}`).join(" "),
              "",
              "## References",
              "",
              "Ng, P. (2024). Climate governance. https://example.com/source"
            ].join("\n")
          }),
          rewriteDraftToTarget,
          verifyReferences: async () => [],
          exportDocx: async () => {
            throw new Error("export should not run");
          },
          exportReferenceReport: async () => {
            throw new Error("report export should not run");
          }
        }
      )
    ).rejects.toMatchObject({
      name: "TaskProcessingStageError",
      stage: "adjusting_word_count"
    } satisfies Partial<TaskProcessingStageError>);

    expect(rewriteDraftToTarget).toHaveBeenCalledTimes(20);
  });
});

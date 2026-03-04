import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { requestOpenAITextResponseMock } = vi.hoisted(() => ({
  requestOpenAITextResponseMock: vi.fn()
}));

vi.mock("../../src/lib/ai/openai-client", () => ({
  requestOpenAITextResponse: requestOpenAITextResponseMock,
  safeParseJSON: (text: string) => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
}));

import { analyzeUploadedTaskWithOpenAI } from "../../src/lib/ai/services/analyze-uploaded-task";

describe("model analysis guardrails", () => {
  beforeEach(() => {
    requestOpenAITextResponseMock.mockReset();
  });

  it("uses the model's outline title when the response omits a separate topic field", async () => {
    requestOpenAITextResponseMock.mockResolvedValue({
      output_text: JSON.stringify({
        analysis: {
          chosenTaskFileId: "file-1",
          supportingFileIds: [],
          ignoredFileIds: [],
          needsUserConfirmation: false,
          reasoning: "The first file is the task brief.",
          targetWordCount: 2750,
          citationStyle: "Harvard",
          topic: "",
          chapterCount: 6,
          mustCover: ["ASEAN banking risk"],
          gradingFocus: ["Critical analysis"],
          appliedSpecialRequirements: "",
          usedDefaultWordCount: false,
          usedDefaultCitationStyle: false,
          warnings: []
        },
        outline: {
          articleTitle: "Finance Risk Governance in ASEAN Banks",
          sections: [
            {
              title: "Introduction",
              summary: "Introduce the governance problem and essay focus.",
              bulletPoints: ["Context", "Problem", "Argument"]
            }
          ]
        }
      })
    });

    const result = await analyzeUploadedTaskWithOpenAI({
      specialRequirements: "",
      files: [
        {
          id: "file-1",
          originalFilename: "assignment.txt",
          extractedText: "Write 2750 words with Harvard referencing."
        }
      ]
    });

    expect(result.analysis.topic).toBe("Finance Risk Governance in ASEAN Banks");
  });

  it("fails instead of silently inventing default requirements when the model omits them", async () => {
    requestOpenAITextResponseMock.mockResolvedValue({
      output_text: JSON.stringify({
        analysis: {
          chosenTaskFileId: "file-1",
          supportingFileIds: [],
          ignoredFileIds: [],
          needsUserConfirmation: false,
          reasoning: "The first file is the task brief.",
          topic: "Finance Risk Governance in ASEAN Banks",
          chapterCount: 6,
          mustCover: [],
          gradingFocus: [],
          appliedSpecialRequirements: "",
          warnings: []
        },
        outline: {
          articleTitle: "Finance Risk Governance in ASEAN Banks",
          sections: [
            {
              title: "Introduction",
              summary: "Introduce the governance problem and essay focus.",
              bulletPoints: ["Context", "Problem", "Argument"]
            }
          ]
        }
      })
    });

    await expect(
      analyzeUploadedTaskWithOpenAI({
        specialRequirements: "",
        files: [
          {
            id: "file-1",
            originalFilename: "assignment.txt",
            extractedText: "Assignment brief text."
          }
        ]
      })
    ).rejects.toThrow("MODEL_ANALYSIS_INCOMPLETE");
  });
});

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

  it("retries once when the first model response is incomplete, then succeeds", async () => {
    requestOpenAITextResponseMock
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          analysis: {
            chosenTaskFileId: "file-1",
            supportingFileIds: [],
            ignoredFileIds: [],
            needsUserConfirmation: false,
            reasoning: "First response missed required fields.",
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
      })
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          analysis: {
            chosenTaskFileId: "file-1",
            supportingFileIds: [],
            ignoredFileIds: [],
            needsUserConfirmation: false,
            reasoning: "The second response is complete.",
            targetWordCount: 2750,
            citationStyle: "Harvard",
            topic: "Finance Risk Governance in ASEAN Banks",
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

    expect(result.analysis.targetWordCount).toBe(2750);
    expect(result.analysis.citationStyle).toBe("Harvard");
    expect(requestOpenAITextResponseMock).toHaveBeenCalledTimes(2);
    expect(requestOpenAITextResponseMock.mock.calls[0]?.[0]).toMatchObject({
      reasoningEffort: "medium"
    });
    expect(requestOpenAITextResponseMock.mock.calls[1]?.[0]).toMatchObject({
      reasoningEffort: "medium"
    });
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
    requestOpenAITextResponseMock
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          analysis: {
            chosenTaskFileId: "file-1",
            supportingFileIds: [],
            ignoredFileIds: [],
            needsUserConfirmation: false,
            reasoning: "The first response is incomplete.",
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
      })
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          analysis: {
            chosenTaskFileId: "file-1",
            supportingFileIds: [],
            ignoredFileIds: [],
            needsUserConfirmation: false,
            reasoning: "The retry response is still incomplete.",
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
    ).rejects.toThrow("MODEL_ANALYSIS_INCOMPLETE_AFTER_RETRY");
  });

  it("uses native PDF file input instead of raw extracted text when openai_file_id exists", async () => {
    requestOpenAITextResponseMock.mockResolvedValue({
      output_text: JSON.stringify({
        analysis: {
          chosenTaskFileId: "pdf-1",
          supportingFileIds: [],
          ignoredFileIds: [],
          needsUserConfirmation: false,
          reasoning: "PDF brief is primary.",
          targetWordCount: 2750,
          citationStyle: "Harvard",
          topic: "Finance Risk Governance in ASEAN Banks",
          chapterCount: 6,
          mustCover: ["Risk governance"],
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

    await analyzeUploadedTaskWithOpenAI({
      specialRequirements: "",
      files: [
        {
          id: "pdf-1",
          originalFilename: "assignment.pdf",
          extractedText: "This extracted text should not be sent when file_id exists.",
          contentType: "application/pdf",
          openaiFileId: "file-openai-pdf-1"
        }
      ]
    });

    const firstCall = requestOpenAITextResponseMock.mock.calls[0]?.[0] as {
      input?: Array<{
        content?: Array<{ type?: string; text?: string; file_id?: string }>;
      }>;
    };
    const content = firstCall.input?.[0]?.content ?? [];
    const inputFileEntries = content.filter((item) => item.type === "input_file");
    const rawExtractedEntries = content.filter(
      (item) => item.type === "input_text" && String(item.text ?? "").includes("RAW_EXTRACTED_TEXT_START")
    );

    expect(inputFileEntries).toHaveLength(1);
    expect(inputFileEntries[0]?.file_id).toBe("file-openai-pdf-1");
    expect(rawExtractedEntries).toHaveLength(0);
  });
});

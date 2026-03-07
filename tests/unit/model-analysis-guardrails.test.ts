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

  it("retries requirements analysis once, then uses the completed requirements to generate the outline", async () => {
    requestOpenAITextResponseMock
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          chosenTaskFileId: null,
          supportingFileIds: [],
          ignoredFileIds: [],
          needsUserConfirmation: false,
          reasoning: "First response missed required fields.",
          topic: "",
          chapterCount: null,
          mustCover: [],
          gradingFocus: [],
          appliedSpecialRequirements: "",
          warnings: []
        })
      })
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
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
        })
      })
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          articleTitle: "Finance Risk Governance in ASEAN Banks",
          sections: [
            {
              title: "Introduction",
              summary: "Introduce the governance problem and essay focus.",
              bulletPoints: ["Context", "Problem", "Argument"]
            }
          ]
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
    expect(result.outline?.articleTitle).toBe("Finance Risk Governance in ASEAN Banks");
    expect(requestOpenAITextResponseMock).toHaveBeenCalledTimes(3);
    expect(requestOpenAITextResponseMock.mock.calls[0]?.[0]).toMatchObject({
      reasoningEffort: "medium"
    });
    expect(requestOpenAITextResponseMock.mock.calls[1]?.[0]).toMatchObject({
      reasoningEffort: "medium"
    });
    expect(requestOpenAITextResponseMock.mock.calls[2]?.[0]).toMatchObject({
      reasoningEffort: "medium"
    });
  });

  it("uses the model's outline title when the response omits a separate topic field", async () => {
    requestOpenAITextResponseMock
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
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
        })
      })
      .mockResolvedValueOnce({
      output_text: JSON.stringify({
        articleTitle: "Finance Risk Governance in ASEAN Banks",
        sections: [
          {
            title: "Introduction",
            summary: "Introduce the governance problem and essay focus.",
            bulletPoints: ["Context", "Problem", "Argument"]
          }
        ]
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

  it("fills in default flags when the model gives explicit requirements but omits the default markers", async () => {
    requestOpenAITextResponseMock
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          chosenTaskFileId: "file-1",
          supportingFileIds: [],
          ignoredFileIds: [],
          needsUserConfirmation: false,
          reasoning: "The file already states the concrete requirements.",
          targetWordCount: 2750,
          citationStyle: "Harvard",
          topic: "Finance Risk Governance in ASEAN Banks",
          chapterCount: 6,
          mustCover: [],
          gradingFocus: [],
          appliedSpecialRequirements: "",
          warnings: []
        })
      })
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          articleTitle: "Finance Risk Governance in ASEAN Banks",
          sections: [
            {
              title: "Introduction",
              summary: "Introduce the governance problem and essay focus.",
              bulletPoints: ["Context", "Problem", "Argument"]
            }
          ]
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
    expect(result.analysis.usedDefaultWordCount).toBe(false);
    expect(result.analysis.usedDefaultCitationStyle).toBe(false);
    expect(result.outline?.articleTitle).toBe("Finance Risk Governance in ASEAN Banks");
    expect(requestOpenAITextResponseMock).toHaveBeenCalledTimes(2);
  });

  it("applies 2000 words and APA 7 when the model omits count/style but the rest of the requirements are usable", async () => {
    requestOpenAITextResponseMock
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          chosenTaskFileId: "file-1",
          supportingFileIds: [],
          ignoredFileIds: [],
          needsUserConfirmation: false,
          reasoning: "The uploaded files do not state a concrete word count or citation style.",
          topic: "Finance Risk Governance in ASEAN Banks",
          chapterCount: 4,
          mustCover: ["Risk governance"],
          gradingFocus: ["Critical analysis"],
          appliedSpecialRequirements: "",
          warnings: []
        })
      })
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          articleTitle: "Finance Risk Governance in ASEAN Banks",
          sections: [
            {
              title: "Introduction",
              summary: "Introduce the governance problem and essay focus.",
              bulletPoints: ["Context", "Problem", "Argument"]
            }
          ]
        })
      });

    const result = await analyzeUploadedTaskWithOpenAI({
      specialRequirements: "",
      files: [
        {
          id: "file-1",
          originalFilename: "assignment.txt",
          extractedText: "Assignment brief text."
        }
      ]
    });

    expect(result.analysis.targetWordCount).toBe(2000);
    expect(result.analysis.citationStyle).toBe("APA 7");
    expect(result.analysis.usedDefaultWordCount).toBe(true);
    expect(result.analysis.usedDefaultCitationStyle).toBe(true);
    expect(result.outline?.articleTitle).toBe("Finance Risk Governance in ASEAN Banks");
    expect(requestOpenAITextResponseMock).toHaveBeenCalledTimes(2);
  });

  it("fails fast when a transport-only pdf did not get an OpenAI file id", async () => {
    await expect(
      analyzeUploadedTaskWithOpenAI({
        specialRequirements: "",
        files: [
          {
            id: "pdf-1",
            originalFilename: "assignment.pdf",
            extractedText: "[pdf transport-only: assignment.pdf]",
            contentType: "application/pdf",
            openaiFileId: null
          }
        ]
      })
    ).rejects.toThrow("MODEL_INPUT_NOT_READY");

    expect(requestOpenAITextResponseMock).not.toHaveBeenCalled();
  });

  it("keeps the successful requirements analysis and only fails the outline stage when the outline stays incomplete", async () => {
    requestOpenAITextResponseMock
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          chosenTaskFileId: "file-1",
          supportingFileIds: [],
          ignoredFileIds: [],
          needsUserConfirmation: false,
          reasoning: "The task brief is clear.",
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
        })
      })
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          articleTitle: "",
          sections: []
        })
      })
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          articleTitle: "",
          sections: []
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
    ).rejects.toThrow("MODEL_OUTLINE_INCOMPLETE_AFTER_RETRY");
  });

  it("uses native PDF file input instead of raw extracted text when openai_file_id exists", async () => {
    requestOpenAITextResponseMock
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
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
        })
      })
      .mockResolvedValueOnce({
      output_text: JSON.stringify({
        articleTitle: "Finance Risk Governance in ASEAN Banks",
        sections: [
          {
            title: "Introduction",
            summary: "Introduce the governance problem and essay focus.",
            bulletPoints: ["Context", "Problem", "Argument"]
          }
        ]
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

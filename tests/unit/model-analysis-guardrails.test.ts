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

  it("uses one model call to return structured analysis and the first outline together", async () => {
    requestOpenAITextResponseMock.mockResolvedValueOnce({
      output_text: JSON.stringify({
        analysis: {
          chosenTaskFileId: "file-1",
          supportingFileIds: [],
          ignoredFileIds: [],
          needsUserConfirmation: false,
          reasoning: "The first file is the real task brief.",
          targetWordCount: 2750,
          citationStyle: "Harvard",
          topic: "Finance Risk Governance in ASEAN Banks",
          chapterCount: 6,
          mustCover: ["ASEAN banking risk"],
          gradingFocus: ["Critical analysis"],
          appliedSpecialRequirements: "Focus on governance.",
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
      specialRequirements: "Focus on governance.",
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
    expect(result.analysis.analysisRenderMode).toBe("structured");
    expect(result.analysis.rawModelResponse).toBeNull();
    expect(result.outline?.articleTitle).toBe("Finance Risk Governance in ASEAN Banks");
    expect(requestOpenAITextResponseMock).toHaveBeenCalledTimes(1);
  });

  it("returns raw fallback when the model replies with readable text but not a formal outline payload", async () => {
    requestOpenAITextResponseMock.mockResolvedValueOnce({
      output_text: [
        "I can draft this paper around finance risk governance.",
        "Suggested structure:",
        "1. Introduction",
        "2. Governance framework",
        "3. Regional banking cases"
      ].join("\n")
    });

    const result = await analyzeUploadedTaskWithOpenAI({
      specialRequirements: "Focus on governance.",
      files: [
        {
          id: "file-1",
          originalFilename: "assignment.txt",
          extractedText: "Assignment brief text."
        }
      ]
    });

    expect(result.outline).toBeNull();
    expect(result.analysis.analysisRenderMode).toBe("raw");
    expect(result.analysis.rawModelResponse).toContain("Suggested structure");
    expect(result.analysis.appliedSpecialRequirements).toBe("Focus on governance.");
    expect(requestOpenAITextResponseMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the structured path when the model says the user must confirm the main task file", async () => {
    requestOpenAITextResponseMock.mockResolvedValueOnce({
      output_text: JSON.stringify({
        analysis: {
          chosenTaskFileId: null,
          supportingFileIds: ["file-1", "file-2"],
          ignoredFileIds: [],
          needsUserConfirmation: true,
          reasoning: "Two files both look like task briefs, so the user must confirm.",
          targetWordCount: 2000,
          citationStyle: "APA 7",
          topic: "Education Policy Essay",
          chapterCount: 4,
          mustCover: [],
          gradingFocus: [],
          appliedSpecialRequirements: "",
          usedDefaultWordCount: true,
          usedDefaultCitationStyle: true,
          warnings: []
        },
        outline: null
      })
    });

    const result = await analyzeUploadedTaskWithOpenAI({
      specialRequirements: "",
      files: [
        {
          id: "file-1",
          originalFilename: "brief-a.txt",
          extractedText: "Brief A"
        },
        {
          id: "file-2",
          originalFilename: "brief-b.txt",
          extractedText: "Brief B"
        }
      ]
    });

    expect(result.analysis.needsUserConfirmation).toBe(true);
    expect(result.analysis.analysisRenderMode).toBe("structured");
    expect(result.outline).toBeNull();
    expect(requestOpenAITextResponseMock).toHaveBeenCalledTimes(1);
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

  it("keeps upstream model outages as real failures instead of pretending raw fallback succeeded", async () => {
    requestOpenAITextResponseMock.mockRejectedValueOnce(
      new Error("OpenAI request failed with status 502: bad gateway")
    );

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
    ).rejects.toThrow("UPSTREAM_MODEL_UNAVAILABLE");
  });
});

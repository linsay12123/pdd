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

import { reviseOutlineFromFilesWithOpenAI } from "../../src/lib/ai/services/revise-outline-from-files";

describe("revise outline model config", () => {
  beforeEach(() => {
    requestOpenAITextResponseMock.mockReset();
  });

  it("uses medium reasoning effort for outline revision", async () => {
    requestOpenAITextResponseMock.mockResolvedValue({
      output_text: JSON.stringify({
        articleTitle: "ASEAN Governance Risk and Banking Stability",
        sections: [
          {
            title: "Introduction",
            summary: "Set up the scope and thesis.",
            bulletPoints: ["Context", "Problem framing", "Argument"]
          },
          {
            title: "Risk Governance",
            summary: "Analyze governance mechanisms and outcomes.",
            bulletPoints: ["Board controls", "Disclosure quality", "Policy implications"]
          }
        ]
      })
    });

    await reviseOutlineFromFilesWithOpenAI({
      files: [
        {
          id: "file-1",
          originalFilename: "assignment.txt",
          extractedText: "Task brief text."
        }
      ],
      analysis: {
        chosenTaskFileId: "file-1",
        supportingFileIds: [],
        ignoredFileIds: [],
        needsUserConfirmation: false,
        reasoning: "brief-defined",
        targetWordCount: 2000,
        citationStyle: "APA 7",
        topic: "ASEAN Governance Risk",
        chapterCount: 4,
        mustCover: [],
        gradingFocus: [],
        appliedSpecialRequirements: "",
        usedDefaultWordCount: false,
        usedDefaultCitationStyle: false,
        warnings: []
      },
      previousOutline: null,
      feedback: "Write three sections and tighten the argument."
    });

    expect(requestOpenAITextResponseMock.mock.calls[0]?.[0]).toMatchObject({
      reasoningEffort: "medium"
    });
  });
});

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
      feedback: "Write three sections and tighten the argument.",
      specialRequirements: ""
    });

    expect(requestOpenAITextResponseMock.mock.calls[0]?.[0]).toMatchObject({
      reasoningEffort: "medium"
    });
  });

  it("sends previous outline, task files, and special requirements without re-sending the chapter rule", async () => {
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
        targetWordCount: 1000,
        citationStyle: "APA 7",
        topic: "ASEAN Governance Risk",
        chapterCount: 3,
        mustCover: [],
        gradingFocus: [],
        appliedSpecialRequirements: "",
        usedDefaultWordCount: false,
        usedDefaultCitationStyle: false,
        warnings: []
      },
      previousOutline: {
        articleTitle: "ASEAN Governance Risk",
        targetWordCount: 1000,
        citationStyle: "APA 7",
        chineseMirrorPending: true,
        chineseMirror: null,
        sections: [
          {
            title: "Introduction",
            summary: "Set up the scope and thesis.",
            bulletPoints: ["Context", "Problem framing", "Argument"]
          }
        ]
      },
      feedback: "Tighten the argument and improve transitions.",
      specialRequirements: "Focus on listed banks in Southeast Asia."
    });

    const request = requestOpenAITextResponseMock.mock.calls[0]?.[0] as {
      input?: Array<{
        role?: string;
        content?: Array<{ type?: string; text?: string }>;
      }>;
    };
    const content = request.input?.[0]?.content ?? [];
    const joinedText = content
      .filter((part) => part.type === "input_text")
      .map((part) => String(part.text ?? ""))
      .join("\n");

    expect(joinedText).toContain("PREVIOUS_OUTLINE:");
    expect(joinedText).toContain(
      "CURRENT_SPECIAL_REQUIREMENTS: Focus on listed banks in Southeast Asia."
    );
    expect(joinedText).toContain("RAW_EXTRACTED_TEXT_START");
    expect(joinedText).toContain("USER_REVISION_FEEDBACK: Tighten the argument and improve transitions.");
    expect(joinedText).not.toContain("1000 words or fewer = exactly 3 chapters");
    expect(joinedText).not.toContain("Each section must contain 3 to 5 specific bullet points");
  });

  it("keeps the revision repair call on previous outline, task files, and special requirements only", async () => {
    requestOpenAITextResponseMock
      .mockResolvedValueOnce({
        output_text: "not valid json"
      })
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          articleTitle: "ASEAN Governance Risk and Banking Stability",
          sections: [
            {
              title: "Introduction",
              summary: "Set up the scope and thesis.",
              bulletPoints: ["Context", "Problem framing", "Argument"]
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
        targetWordCount: 1000,
        citationStyle: "APA 7",
        topic: "ASEAN Governance Risk",
        chapterCount: 3,
        mustCover: [],
        gradingFocus: [],
        appliedSpecialRequirements: "",
        usedDefaultWordCount: false,
        usedDefaultCitationStyle: false,
        warnings: []
      },
      previousOutline: {
        articleTitle: "ASEAN Governance Risk",
        targetWordCount: 1000,
        citationStyle: "APA 7",
        chineseMirrorPending: true,
        chineseMirror: null,
        sections: [
          {
            title: "Introduction",
            summary: "Set up the scope and thesis.",
            bulletPoints: ["Context", "Problem framing", "Argument"]
          }
        ]
      },
      feedback: "Tighten the argument and improve transitions.",
      specialRequirements: "Focus on listed banks in Southeast Asia."
    });

    const repairRequest = requestOpenAITextResponseMock.mock.calls[1]?.[0] as {
      input?: string;
    };
    const repairPrompt = String(repairRequest.input ?? "");

    expect(repairPrompt).toContain("PREVIOUS_OUTLINE:");
    expect(repairPrompt).toContain(
      "CURRENT_SPECIAL_REQUIREMENTS: Focus on listed banks in Southeast Asia."
    );
    expect(repairPrompt).toContain("RAW_EXTRACTED_TEXT_START");
    expect(repairPrompt).not.toContain("1000 words or fewer = exactly 3 chapters");
    expect(repairPrompt).not.toContain("Each section must contain 3 to 5 specific bullet points");
  });
});

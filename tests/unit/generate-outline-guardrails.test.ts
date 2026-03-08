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

import { generateOutlineForTask } from "../../trigger/jobs/generate-outline";

describe("generate outline guardrails", () => {
  beforeEach(() => {
    requestOpenAITextResponseMock.mockReset();
  });

  it("rejects placeholder outlines instead of falling back to a fake template", async () => {
    requestOpenAITextResponseMock
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          articleTitle: "Corporate Governance: A Structured Analysis",
          sections: [
            {
              title: "Introduction",
              summary:
                "Introduction will explain how corporate governance develops in this section.",
              bulletPoints: [
                "Introduction focus point 1",
                "Introduction focus point 2",
                "Introduction focus point 3"
              ]
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          articleTitle: "Corporate Governance: A Structured Analysis",
          sections: [
            {
              title: "Introduction",
              summary:
                "Introduction will explain how corporate governance develops in this section.",
              bulletPoints: [
                "Introduction focus point 1",
                "Introduction focus point 2",
                "Introduction focus point 3"
              ]
            }
          ]
        })
      });

    await expect(
      generateOutlineForTask({
        topic: "Corporate Governance",
        targetWordCount: 2000,
        citationStyle: "APA 7"
      })
    ).rejects.toThrow("MODEL_RETURNED_INVALID_OUTLINE");

    expect(requestOpenAITextResponseMock.mock.calls[0]?.[0]).toMatchObject({
      reasoningEffort: "medium"
    });
  });

  it("keeps the chapter rule inside the legacy first-outline repair prompt", async () => {
    requestOpenAITextResponseMock
      .mockResolvedValueOnce({
        output_text: "not valid json"
      })
      .mockResolvedValueOnce({
        output_text: JSON.stringify({
          articleTitle: "Corporate Governance",
          sections: [
            {
              title: "Introduction",
              summary: "Set up the problem and thesis.",
              bulletPoints: ["Context", "Problem", "Argument"]
            },
            {
              title: "Analysis",
              summary: "Analyze the key evidence.",
              bulletPoints: ["Evidence", "Debate", "Implications"]
            },
            {
              title: "Conclusion",
              summary: "Close the argument.",
              bulletPoints: ["Findings", "Limits", "Takeaway"]
            }
          ]
        })
      });

    await generateOutlineForTask({
      topic: "Corporate Governance",
      targetWordCount: 1000,
      citationStyle: "APA 7",
      specialRequirements: "Focus on ASEAN listed banks."
    });

    const repairPrompt = String(requestOpenAITextResponseMock.mock.calls[1]?.[0]?.input ?? "");

    expect(repairPrompt).toContain("SPECIAL_REQUIREMENTS: Focus on ASEAN listed banks.");
    expect(repairPrompt).toContain("1000 words or fewer = exactly 3 chapters");
    expect(repairPrompt).toContain("Each section must contain 3 to 5 specific bullet points");
  });
});

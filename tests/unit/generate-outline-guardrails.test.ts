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
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { generateDraftFromOutline } from "../../trigger/jobs/generate-draft";

describe("generate draft job", () => {
  it("uses gpt-5.2 with high reasoning effort for article writing", async () => {
    const calls: Array<{
      input: string | Array<Record<string, unknown>>;
      model?: string;
      reasoningEffort?: "low" | "medium" | "high";
    }> = [];

    const result = await generateDraftFromOutline({
      outline: {
        articleTitle: "AI in Education",
        targetWordCount: 2000,
        citationStyle: "APA 7",
        chineseMirrorPending: true,
        sections: [
          {
            title: "Introduction",
            summary: "Explain the topic.",
            bulletPoints: ["Point 1", "Point 2", "Point 3"]
          }
        ]
      },
      specialRequirements: "Use a formal academic tone.",
      safetyIdentifier: "pdd_user_hash_123",
      requestText: async (request) => {
        calls.push(request);
        return {
          output_text: "# AI in Education\n\n## Introduction\n\nFormal article body.\n\nReferences\n\nSmith (2024)."
        };
      }
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      model: "gpt-5.2",
      reasoningEffort: "high",
      safetyIdentifier: "pdd_user_hash_123"
    });
    expect(result.draft).toContain("Formal article body");
  });
});

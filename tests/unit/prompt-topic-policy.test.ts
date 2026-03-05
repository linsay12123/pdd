import { describe, expect, it } from "vitest";
import { buildAnalyzeUploadedTaskInstruction } from "../../src/lib/ai/prompts/analyze-uploaded-task";
import { buildReviseOutlineInstruction } from "../../src/lib/ai/prompts/revise-outline-from-files";

describe("topic selection policy prompts", () => {
  it("includes TOPIC_SELECTION_POLICY in upload analysis prompt", () => {
    const prompt = buildAnalyzeUploadedTaskInstruction({
      specialRequirements: "Focus on ASEAN governance"
    });

    expect(prompt).toContain("TOPIC_SELECTION_POLICY");
    expect(prompt).toContain("brief explicitly states");
    expect(prompt).toContain("open or semi-open");
    expect(prompt).toContain("propose one specific, arguable topic");
  });

  it("includes fixed-topic guardrail in outline revision prompt", () => {
    const prompt = buildReviseOutlineInstruction({
      analysis: {
        chosenTaskFileId: "file-1",
        supportingFileIds: [],
        ignoredFileIds: [],
        needsUserConfirmation: false,
        reasoning: "brief-defined",
        targetWordCount: 2500,
        citationStyle: "Harvard",
        topic: "ASEAN Governance Risk",
        chapterCount: 5,
        mustCover: ["Risk governance"],
        gradingFocus: ["Critical analysis"],
        appliedSpecialRequirements: "Focus on ASEAN governance",
        usedDefaultWordCount: false,
        usedDefaultCitationStyle: false,
        warnings: []
      },
      previousOutline: {
        articleTitle: "ASEAN Governance Risk",
        targetWordCount: 2500,
        citationStyle: "Harvard",
        chineseMirrorPending: true,
        chineseMirror: null,
        sections: [
          {
            title: "Intro",
            summary: "Scope and argument.",
            bulletPoints: ["Context", "Thesis"]
          }
        ]
      },
      feedback: "write three sections"
    });

    expect(prompt).toContain("TOPIC_SELECTION_POLICY");
    expect(prompt).toContain("must not override explicit fixed-topic requirements");
    expect(prompt).toContain("Never output a generic placeholder topic/title");
  });
});

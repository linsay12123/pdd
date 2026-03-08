import { describe, expect, it } from "vitest";
import { buildAnalyzeUploadedTaskInstruction } from "../../src/lib/ai/prompts/analyze-uploaded-task";
import { buildReviseOutlineInstruction } from "../../src/lib/ai/prompts/revise-outline-from-files";
import { buildAdjustWordCountPrompt } from "../../src/lib/ai/prompts/adjust-word-count";
import { buildGenerateDraftPrompt } from "../../src/lib/ai/prompts/generate-draft";

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

  it("includes the new chapter sizing rule and bullet-point limits in upload analysis prompt", () => {
    const prompt = buildAnalyzeUploadedTaskInstruction({
      specialRequirements: "Keep it concise"
    });

    expect(prompt).toContain("1000 words or fewer = exactly 3 chapters");
    expect(prompt).toContain("800 -> 3");
    expect(prompt).toContain("1000 -> 3");
    expect(prompt).toContain("1001 -> 4");
    expect(prompt).toContain("1800 -> 4");
    expect(prompt).toContain("2000 -> 4");
    expect(prompt).toContain("2001 -> 5");
    expect(prompt).toContain("Each section must contain 3 to 5 specific bullet points");
    expect(prompt).toContain("Never output fewer than 3 or more than 5 bullet points");
  });

  it("includes fixed-topic guardrail in outline revision prompt", () => {
    const prompt = buildReviseOutlineInstruction({
      specialRequirements: "Focus on ASEAN governance",
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
    expect(prompt).toContain("CURRENT_SPECIAL_REQUIREMENTS: Focus on ASEAN governance");
    expect(prompt).toContain("PREVIOUS_OUTLINE:");
    expect(prompt).toContain("USER_REVISION_FEEDBACK: write three sections");
    expect(prompt).not.toContain("1000 words or fewer = exactly 3 chapters");
    expect(prompt).not.toContain("800 -> 3");
    expect(prompt).not.toContain("2001 -> 5");
    expect(prompt).not.toContain("Each section must contain 3 to 5 specific bullet points");
    expect(prompt).not.toContain("Never output fewer than 3 or more than 5 bullet points");
  });

  it("keeps the outline chapter rule out of draft generation prompts", () => {
    const prompt = buildGenerateDraftPrompt({
      outline: {
        articleTitle: "ASEAN Governance Risk",
        targetWordCount: 1000,
        citationStyle: "Harvard",
        chineseMirrorPending: true,
        chineseMirror: null,
        sections: [
          {
            title: "Introduction",
            summary: "Set up the topic and scope.",
            bulletPoints: ["Context", "Problem", "Argument"]
          }
        ]
      },
      specialRequirements: "Focus on ASEAN governance"
    });

    expect(prompt).not.toContain("1000 words or fewer = exactly 3 chapters");
    expect(prompt).not.toContain("Each section must contain 3 to 5 specific bullet points");
  });

  it("keeps the outline chapter rule out of word-count adjustment prompts", () => {
    const prompt = buildAdjustWordCountPrompt({
      draft: "# Title\n\nBody.\n\nReferences\n\nSource.",
      currentWordCount: 1200,
      targetWordCount: 1000
    });

    expect(prompt).not.toContain("1000 words or fewer = exactly 3 chapters");
    expect(prompt).not.toContain("Each section must contain 3 to 5 specific bullet points");
  });
});

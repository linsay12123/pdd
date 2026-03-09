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
    expect(prompt).toContain("outline.sections.length");
    expect(prompt).toContain("must exactly equal analysis.chapterCount");
    expect(prompt).toContain("Return exactly that many sections, no more and no fewer");
    expect(prompt).toContain("References");
    expect(prompt).toContain("Appendix");
    expect(prompt).toContain("Bibliography");
    expect(prompt).toContain("must not appear in outline.sections");
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
    expect(prompt).toContain("write the entire article at once");
    expect(prompt).toContain("write all these chapters");
    expect(prompt).toContain("The reasoning effort should be high");
    expect(prompt).toContain("Write in paragraphs, no bullet point");
    expect(prompt).toContain("This is supposed to be an critical argumentative discussion");
    expect(prompt).toContain("Do not Use straight quotation marks");
    expect(prompt).toContain("Do not use em dash");
    expect(prompt).toContain("avoid using “不是…而是..”句式");
    expect(prompt).toContain("each references should come with proper link");
  });

  it("keeps the outline chapter rule out of word-count adjustment prompts", () => {
    const prompt = buildAdjustWordCountPrompt({
      draft: "# Title\n\nBody.\n\nReferences\n\nSource.",
      currentWordCount: 1200,
      targetWordCount: 1000
    });

    expect(prompt).not.toContain("1000 words or fewer = exactly 3 chapters");
    expect(prompt).not.toContain("Each section must contain 3 to 5 specific bullet points");
    expect(prompt).toContain("Adjust only the main article body");
    expect(prompt).toContain("Do not remove the title");
    expect(prompt).toContain("Do not remove or rewrite the References section");
    expect(prompt).toContain("References do not count toward the target body word count");
    expect(prompt).toContain("The final body word count must land within plus or minus 10 words");
  });
});

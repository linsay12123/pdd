import { describe, expect, it } from "vitest";
import {
  applyCandidateDraft,
  countBodyWords,
  shouldPromoteCandidateDraft
} from "../../src/lib/drafts/word-count";

describe("word count adjustment", () => {
  it("counts only the article body and ignores the references section", () => {
    const markdown = [
      "# Title",
      "",
      "This is the first paragraph.",
      "",
      "This is the second paragraph.",
      "",
      "References",
      "",
      "Author, A. (2024). Source."
    ].join("\n");

    expect(countBodyWords(markdown)).toBe(11);
  });

  it("returns zero for an empty body", () => {
    expect(countBodyWords("")).toBe(0);
  });

  it("promotes a structurally valid candidate when it is closer to the target", () => {
    expect(
      shouldPromoteCandidateDraft({
        currentWordCount: 2400,
        candidateWordCount: 2050,
        targetWordCount: 2000,
        candidateHasTitle: true,
        candidateHasReferences: true
      })
    ).toBe(true);
  });

  it("keeps the current draft when the candidate fails structural checks", () => {
    expect(
      shouldPromoteCandidateDraft({
        currentWordCount: 2400,
        candidateWordCount: 2050,
        targetWordCount: 2000,
        candidateHasTitle: false,
        candidateHasReferences: true
      })
    ).toBe(false);
  });

  it("returns both the chosen draft and the candidate metadata for UI display", () => {
    const result = applyCandidateDraft({
      currentDraft: "# Title\n\nBody paragraph.\n\nReferences\n\nA source.",
      candidateDraft:
        "# Title\n\nBody paragraph one. Body paragraph two.\n\nReferences\n\nA source.",
      targetWordCount: 6
    });

    expect(result.chosenDraft).toContain("Body paragraph one");
    expect(result.candidateWordCount).toBeGreaterThan(0);
    expect(result.candidateWasPromoted).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import {
  buildOutlineScaffold,
  calculateDefaultChapterCount,
  determineOutlineBulletCount
} from "../../src/lib/ai/prompts/generate-outline";

describe("outline rules", () => {
  it("defaults to one chapter per 500 words", () => {
    expect(calculateDefaultChapterCount(500)).toBe(1);
    expect(calculateDefaultChapterCount(1200)).toBe(3);
    expect(calculateDefaultChapterCount(2000)).toBe(4);
  });

  it("scales bullet count by article size", () => {
    expect(determineOutlineBulletCount(1200)).toBe(3);
    expect(determineOutlineBulletCount(2000)).toBe(4);
    expect(determineOutlineBulletCount(3200)).toBe(5);
  });

  it("keeps bullet count short when user asks for a shorter outline", () => {
    expect(determineOutlineBulletCount(3200, true)).toBe(3);
  });

  it("builds a scaffold that matches the chosen chapter count", () => {
    const outline = buildOutlineScaffold({
      topic: "Digital Supply Chains",
      targetWordCount: 2000,
      citationStyle: "APA 7",
      chapterCountOverride: 3,
      shorterOutline: false
    });

    expect(outline.articleTitle).toContain("Digital Supply Chains");
    expect(outline.sections).toHaveLength(3);
    expect(outline.sections[0].bulletPoints).toHaveLength(4);
    expect(outline.targetWordCount).toBe(2000);
    expect(outline.citationStyle).toBe("APA 7");
  });
});

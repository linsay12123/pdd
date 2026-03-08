import { describe, expect, it } from "vitest";
import {
  calculateDefaultChapterCount,
  determineOutlineBulletCount
} from "../../src/lib/ai/prompts/generate-outline";

describe("outline rules", () => {
  it("defaults to three chapters for 1000 words and then adds one chapter per extra 1000 words", () => {
    expect(calculateDefaultChapterCount(800)).toBe(3);
    expect(calculateDefaultChapterCount(1000)).toBe(3);
    expect(calculateDefaultChapterCount(1001)).toBe(4);
    expect(calculateDefaultChapterCount(1800)).toBe(4);
    expect(calculateDefaultChapterCount(2000)).toBe(4);
    expect(calculateDefaultChapterCount(2001)).toBe(5);
  });

  it("scales bullet count by article size", () => {
    expect(determineOutlineBulletCount(1200)).toBe(3);
    expect(determineOutlineBulletCount(2000)).toBe(4);
    expect(determineOutlineBulletCount(3200)).toBe(5);
  });

  it("keeps longer articles at five bullets instead of using any local 'shorten outline' switch", () => {
    expect(determineOutlineBulletCount(3200)).toBe(5);
  });
});

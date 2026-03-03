import { describe, expect, it } from "vitest";
import {
  humanizeDraft,
  maxHumanizeChunkLength,
  splitDraftForHumanize
} from "../../src/lib/humanize/stealthgpt-client";
import type { HumanizeProvider } from "../../src/lib/humanize/humanize-provider";

describe("humanize draft utilities", () => {
  it("splits only article body into chunk-sized sections and preserves references", () => {
    const parsed = splitDraftForHumanize(`# Sample Title

## Introduction

Short opening paragraph.

## Analysis

${"A".repeat(maxHumanizeChunkLength + 120)}

## References

Smith, A. (2024). Source.`);

    expect(parsed.title).toBe("Sample Title");
    expect(parsed.references).toContain("Smith, A. (2024). Source.");
    expect(parsed.sections).toHaveLength(2);
    expect(parsed.sections[0]?.chunks).toEqual(["Short opening paragraph."]);
    expect(parsed.sections[1]?.chunks.length).toBeGreaterThan(1);
    expect(
      parsed.sections[1]?.chunks.every(
        (chunk) => chunk.length <= maxHumanizeChunkLength
      )
    ).toBe(true);
  });

  it("rewrites chunks via the abstract provider and keeps structure intact", async () => {
    const mockProvider: HumanizeProvider = {
      name: "test",
      async rewriteChunk({ chunk }) {
        return { rewrittenText: `REWRITTEN:${chunk}` };
      }
    };

    const draft = `# Sample Title

## Introduction

Original paragraph.

## References

Smith, A. (2024). Source.`;

    const result = await humanizeDraft(draft, mockProvider);

    expect(result).toContain("# Sample Title");
    expect(result).toContain("## Introduction");
    expect(result).toContain("REWRITTEN:Original paragraph.");
    expect(result).toContain("## References");
    expect(result).toContain("Smith, A. (2024). Source.");
  });
});

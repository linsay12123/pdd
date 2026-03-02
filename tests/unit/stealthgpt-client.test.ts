import { describe, expect, it, vi } from "vitest";
import {
  buildStealthGptPayload,
  humanizeDraftWithStealthGpt,
  maxStealthGptChunkLength,
  splitDraftForHumanize,
  stealthGptApiUrl
} from "../../src/lib/humanize/stealthgpt-client";

describe("stealthgpt client", () => {
  it("splits only article body into chunk-sized sections and preserves references", () => {
    const parsed = splitDraftForHumanize(`# Sample Title

## Introduction

Short opening paragraph.

## Analysis

${"A".repeat(maxStealthGptChunkLength + 120)}

## References

Smith, A. (2024). Source.`);

    expect(parsed.title).toBe("Sample Title");
    expect(parsed.references).toContain("Smith, A. (2024). Source.");
    expect(parsed.sections).toHaveLength(2);
    expect(parsed.sections[0]?.chunks).toEqual(["Short opening paragraph."]);
    expect(parsed.sections[1]?.chunks.length).toBeGreaterThan(1);
    expect(
      parsed.sections[1]?.chunks.every(
        (chunk) => chunk.length <= maxStealthGptChunkLength
      )
    ).toBe(true);
  });

  it("calls the StealthGPT endpoint and keeps the title, headings, and references", async () => {
    const fetchSpy = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        prompt: string;
      };

      return {
        ok: true,
        status: 200,
        json: async () => ({
          result: `HUMANIZED:${body.prompt}`
        })
      } as Response;
    });

    const draft = `# Sample Title

## Introduction

Original paragraph.

## References

Smith, A. (2024). Source.`;

    const result = await humanizeDraftWithStealthGpt({
      draftMarkdown: draft,
      apiKey: "test-key",
      fetchImpl: fetchSpy as typeof fetch
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(stealthGptApiUrl);
    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({
        "Content-Type": "application/json",
        "api-token": "test-key"
      })
    });
    expect(buildStealthGptPayload("Original paragraph.")).toMatchObject({
      prompt: "Original paragraph.",
      rephrase: true
    });
    expect(result).toContain("# Sample Title");
    expect(result).toContain("## Introduction");
    expect(result).toContain("HUMANIZED:Original paragraph.");
    expect(result).toContain("## References");
    expect(result).toContain("Smith, A. (2024). Source.");
  });
});

import { describe, expect, it, vi } from "vitest";
import { PlaceholderHumanizeProvider } from "../../src/lib/humanize/placeholder-provider";
import { StealthGptProvider } from "../../src/lib/humanize/stealthgpt-provider";
import { resolveHumanizeProvider } from "../../src/lib/humanize/resolve-provider";

describe("humanize providers", () => {
  describe("PlaceholderHumanizeProvider", () => {
    it("returns the input text unchanged", async () => {
      const provider = new PlaceholderHumanizeProvider();
      const result = await provider.rewriteChunk({ chunk: "Hello world." });

      expect(provider.name).toBe("placeholder");
      expect(result.rewrittenText).toBe("Hello world.");
    });
  });

  describe("StealthGptProvider", () => {
    it("calls the StealthGPT API and returns the rewritten text", async () => {
      const fetchSpy = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { prompt: string };

        return {
          ok: true,
          status: 200,
          json: async () => ({ result: `HUMANIZED:${body.prompt}` })
        } as Response;
      });

      const provider = new StealthGptProvider({
        apiKey: "test-key",
        fetchImpl: fetchSpy as typeof fetch
      });

      const result = await provider.rewriteChunk({ chunk: "Original text." });

      expect(provider.name).toBe("stealthgpt");
      expect(result.rewrittenText).toBe("HUMANIZED:Original text.");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0]?.[0]).toBe("https://stealthgpt.ai/api/stealthify");
      expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "api-token": "test-key"
        })
      });
    });

    it("returns empty string for blank chunks", async () => {
      const provider = new StealthGptProvider({
        apiKey: "test-key"
      });

      const result = await provider.rewriteChunk({ chunk: "   " });
      expect(result.rewrittenText).toBe("");
    });
  });

  describe("resolveHumanizeProvider", () => {
    it("returns override provider when provided", () => {
      const override = new PlaceholderHumanizeProvider();
      const resolved = resolveHumanizeProvider(override);
      expect(resolved).toBe(override);
    });

    it("falls back to placeholder when no API key is set", () => {
      const original = process.env.STEALTHGPT_API_KEY;
      delete process.env.STEALTHGPT_API_KEY;

      const resolved = resolveHumanizeProvider();
      expect(resolved.name).toBe("placeholder");

      if (original !== undefined) {
        process.env.STEALTHGPT_API_KEY = original;
      }
    });
  });
});

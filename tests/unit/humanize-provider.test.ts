import { beforeEach, describe, expect, it, vi } from "vitest";
import { UndetectableProvider } from "../../src/lib/humanize/undetectable-provider";
import { resolveHumanizeProvider } from "../../src/lib/humanize/resolve-provider";

describe("humanize providers", () => {
  beforeEach(() => {
    delete process.env.UNDETECTABLE_API_KEY;
  });

  describe("UndetectableProvider", () => {
    it("submits a document with the locked default profile", async () => {
      const fetchSpy = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;

        return new Response(
          JSON.stringify({
            id: "doc-1",
            status: "pending",
            readability: body.readability,
            purpose: body.purpose,
            strength: body.strength,
            model: body.model
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        );
      });

      const provider = new UndetectableProvider({
        apiKey: "undetectable-key",
        fetchImpl: fetchSpy as unknown as typeof fetch
      });

      const result = await provider.submitDocument({
        content: "A rewritten draft body."
      });

      expect(provider.name).toBe("undetectable");
      expect(result.documentId).toBe("doc-1");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0]?.[0]).toBe("https://humanize.undetectable.ai/submit");
      expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          apikey: "undetectable-key"
        })
      });

      const payload = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
      expect(payload.readability).toBe("University");
      expect(payload.purpose).toBe("Essay");
      expect(payload.strength).toBe("More Human");
      expect(payload.model).toBe("v11sr");
    });

    it("loads the current document result", async () => {
      const fetchSpy = vi.fn(async (_url: URL | RequestInfo, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            id: "doc-1",
            status: "done",
            output: "Humanized body"
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      );

      const provider = new UndetectableProvider({
        apiKey: "undetectable-key",
        fetchImpl: fetchSpy as unknown as typeof fetch
      });

      const result = await provider.getDocument("doc-1");

      expect(result.status).toBe("done");
      expect(result.output).toBe("Humanized body");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0]?.[0]).toBe("https://humanize.undetectable.ai/document");
    });

    it("asks Undetectable to rehumanize a bad first result", async () => {
      const fetchSpy = vi.fn(async (_url: URL | RequestInfo, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            id: "doc-2",
            status: "pending"
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      );

      const provider = new UndetectableProvider({
        apiKey: "undetectable-key",
        fetchImpl: fetchSpy as unknown as typeof fetch
      });

      const result = await provider.rehumanize("doc-1");

      expect(result.documentId).toBe("doc-2");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0]?.[0]).toBe("https://humanize.undetectable.ai/rehumanize");
    });
  });

  describe("resolveHumanizeProvider", () => {
    it("returns override provider when provided", () => {
      const override = {
        name: "override",
        submitDocument: vi.fn(),
        getDocument: vi.fn(),
        rehumanize: vi.fn()
      };

      const resolved = resolveHumanizeProvider(override as never);
      expect(resolved).toBe(override);
    });

    it("throws when no real Undetectable key is configured", () => {
      expect(() => resolveHumanizeProvider()).toThrow("UNDETECTABLE_API_KEY_MISSING");
    });
  });
});

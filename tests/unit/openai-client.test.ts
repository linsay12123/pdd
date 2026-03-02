import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  requestOpenAITextResponse
} from "../../src/lib/ai/openai-client";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("openai client", () => {
  it("sends reasoning effort when requested", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: "done"
      })
    });
    vi.stubGlobal("fetch", fetchSpy);

    await requestOpenAITextResponse({
      input: "Write the article.",
      model: "gpt-5.2",
      reasoningEffort: "high",
      apiKey: "test-key",
      fetchImpl: fetchSpy as typeof fetch
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse(String(init?.body));

    expect(body.model).toBe("gpt-5.2");
    expect(body.input).toBe("Write the article.");
    expect(body.reasoning).toEqual({
      effort: "high"
    });
  });

  it("forwards a safety identifier without exposing the api key", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: "done"
      })
    });

    await requestOpenAITextResponse({
      input: "Outline this task.",
      apiKey: "test-key",
      fetchImpl: fetchSpy as typeof fetch,
      safetyIdentifier: "pdd_user_hash_123"
    });

    const [, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse(String(init?.body));

    expect(body.safety_identifier).toBe("pdd_user_hash_123");
    expect(String(init?.headers?.Authorization ?? "")).not.toContain("undefined");
  });
});

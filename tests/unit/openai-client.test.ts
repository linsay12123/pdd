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

  it("retries when OpenAI returns 429", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: {
          get: () => "1"
        },
        text: async () => '{"error":"rate_limited"}'
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output_text: "retried-success"
        })
      });

    const sleepSpy = vi.fn().mockResolvedValue(undefined);

    const response = await requestOpenAITextResponse({
      input: "retry me",
      apiKey: "test-key",
      fetchImpl: fetchSpy as typeof fetch,
      sleepImpl: sleepSpy,
      maxAttempts: 2
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(sleepSpy).toHaveBeenCalledTimes(1);
    expect(response.output_text).toBe("retried-success");
  });

  it("surfaces response body for non-retryable errors", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: {
        get: () => null
      },
      text: async () => '{"error":{"message":"bad input"}}'
    });

    try {
      await requestOpenAITextResponse({
        input: "bad",
        apiKey: "test-key",
        fetchImpl: fetchSpy as typeof fetch,
        maxAttempts: 1
      });
      throw new Error("expected requestOpenAITextResponse to throw");
    } catch (error) {
      const providerError = error as Error & {
        providerStatusCode?: number;
        providerErrorBody?: string;
        providerErrorKind?: string;
      };
      expect(providerError.message).toContain("bad input");
      expect(providerError.providerStatusCode).toBe(400);
      expect(providerError.providerErrorBody).toContain("bad input");
      expect(providerError.providerErrorKind).toBe("http_error");
    }
  });

  it("times out and retries according to maxAttempts", async () => {
    const fetchSpy = vi.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const timeoutError = new Error("aborted");
            timeoutError.name = "AbortError";
            reject(timeoutError);
          });
        })
    );
    const sleepSpy = vi.fn().mockResolvedValue(undefined);

    await expect(
      requestOpenAITextResponse({
        input: "timeout",
        apiKey: "test-key",
        fetchImpl: fetchSpy as typeof fetch,
        timeoutMs: 10,
        maxAttempts: 2,
        sleepImpl: sleepSpy
      })
    ).rejects.toThrow("OpenAI request timed out");

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(sleepSpy).toHaveBeenCalledTimes(1);
  });
});

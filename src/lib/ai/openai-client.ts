import "server-only";
import { env } from "@/src/config/env";
import type { TaskProviderErrorKind } from "@/src/types/tasks";

export const defaultOpenAIModel = "gpt-5.2";

type OpenAITextResponseRequest = {
  input: string | Array<Record<string, unknown>>;
  model?: string;
  reasoningEffort?: "low" | "medium" | "high";
  safetyIdentifier?: string;
  textFormat?: Record<string, unknown>;
  tools?: Array<Record<string, unknown>>;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxAttempts?: number;
  retryBaseDelayMs?: number;
  sleepImpl?: (ms: number) => Promise<void>;
};

type OpenAITextResponse = {
  output_text: string;
  raw?: Record<string, unknown>;
};

export type OpenAIRequestError = Error & {
  providerStatusCode?: number | null;
  providerErrorBody?: string | null;
  providerErrorKind?: TaskProviderErrorKind | null;
};

const MAX_ERROR_BODY_LENGTH = 2_000;

export async function requestOpenAITextResponse({
  input,
  model = defaultOpenAIModel,
  reasoningEffort,
  safetyIdentifier,
  textFormat,
  tools,
  apiKey = env.OPENAI_API_KEY,
  fetchImpl = fetch,
  timeoutMs = 120_000,
  maxAttempts = 3,
  retryBaseDelayMs = 600,
  sleepImpl = sleep
}: OpenAITextResponseRequest): Promise<OpenAITextResponse> {
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const requestBody = {
    model,
    input,
    ...(textFormat
      ? {
          text: {
            format: textFormat
          }
        }
      : {}),
    ...(tools?.length ? { tools } : {}),
    ...(reasoningEffort
      ? {
          reasoning: {
            effort: reasoningEffort
          }
        }
      : {}),
    ...(safetyIdentifier
      ? {
          safety_identifier: safetyIdentifier
        }
      : {})
  };

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= Math.max(1, maxAttempts); attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      if (!response.ok) {
        const bodyText = await safeReadResponseBody(response);
        const error = createOpenAIRequestError(
          bodyText
            ? `OpenAI request failed with status ${response.status}: ${bodyText}`
            : `OpenAI request failed with status ${response.status}`,
          {
            providerStatusCode: response.status,
            providerErrorBody: bodyText || null,
            providerErrorKind: "http_error"
          }
        );

        if (!isRetryableStatus(response.status) || attempt >= Math.max(1, maxAttempts)) {
          throw error;
        }

        lastError = error;
        await sleepImpl(resolveRetryDelayMs({
          attempt,
          baseDelayMs: retryBaseDelayMs,
          retryAfterHeader: response.headers.get("retry-after")
        }));
        continue;
      }

      const data = (await response.json()) as {
        output_text?: string;
      } & Record<string, unknown>;

      return {
        output_text: data.output_text ?? "",
        raw: data
      };
    } catch (error) {
      const normalized = normalizeOpenAIError(error);
      if (attempt >= Math.max(1, maxAttempts) || !isRetryableRuntimeError(normalized)) {
        throw normalized;
      }

      lastError = normalized;
      await sleepImpl(resolveRetryDelayMs({
        attempt,
        baseDelayMs: retryBaseDelayMs
      }));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError ?? new Error("OpenAI request failed");
}

export function safeParseJSON<T>(text: string): T | null {
  try {
    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

async function safeReadResponseBody(response: Response) {
  try {
    const text = await response.text();
    const normalized = text.trim();
    if (!normalized) {
      return "";
    }
    return normalized.slice(0, MAX_ERROR_BODY_LENGTH);
  } catch {
    return "";
  }
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function isRetryableRuntimeError(error: Error) {
  return (
    error.message === "OpenAI request timed out" ||
    error.message.includes("fetch failed") ||
    error.message.includes("network")
  );
}

function normalizeOpenAIError(error: unknown) {
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return createOpenAIRequestError("OpenAI request timed out", {
        providerStatusCode: null,
        providerErrorBody: null,
        providerErrorKind: "timeout"
      });
    }

    const existing = error as OpenAIRequestError;
    if (
      existing.providerErrorKind !== undefined ||
      existing.providerStatusCode !== undefined ||
      existing.providerErrorBody !== undefined
    ) {
      return existing;
    }

    const normalizedMessage = error.message.toLowerCase();
    if (normalizedMessage.includes("fetch failed") || normalizedMessage.includes("network")) {
      return createOpenAIRequestError(error.message, {
        providerStatusCode: null,
        providerErrorBody: null,
        providerErrorKind: "transport_error"
      });
    }

    return error as OpenAIRequestError;
  }
  return createOpenAIRequestError(String(error), {
    providerStatusCode: null,
    providerErrorBody: null,
    providerErrorKind: "transport_error"
  });
}

function createOpenAIRequestError(
  message: string,
  input: {
    providerStatusCode?: number | null;
    providerErrorBody?: string | null;
    providerErrorKind?: TaskProviderErrorKind | null;
  }
) {
  const error = new Error(message) as OpenAIRequestError;
  error.providerStatusCode = input.providerStatusCode ?? null;
  error.providerErrorBody = input.providerErrorBody ?? null;
  error.providerErrorKind = input.providerErrorKind ?? null;
  return error;
}

function resolveRetryDelayMs(input: {
  attempt: number;
  baseDelayMs: number;
  retryAfterHeader?: string | null;
}) {
  const retryAfter = parseRetryAfterMs(input.retryAfterHeader);
  if (retryAfter !== null) {
    return retryAfter;
  }

  const cappedAttempt = Math.min(input.attempt, 5);
  return input.baseDelayMs * 2 ** (cappedAttempt - 1);
}

function parseRetryAfterMs(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.floor(seconds * 1000);
  }

  const dateMs = Date.parse(value);
  if (!Number.isFinite(dateMs)) {
    return null;
  }

  const delta = dateMs - Date.now();
  return delta > 0 ? delta : null;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, Math.max(0, ms));
  });
}

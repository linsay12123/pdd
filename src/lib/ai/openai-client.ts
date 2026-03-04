import "server-only";
import { env } from "@/src/config/env";

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
};

type OpenAITextResponse = {
  output_text: string;
  raw?: Record<string, unknown>;
};

export async function requestOpenAITextResponse({
  input,
  model = defaultOpenAIModel,
  reasoningEffort,
  safetyIdentifier,
  textFormat,
  tools,
  apiKey = env.OPENAI_API_KEY,
  fetchImpl = fetch
}: OpenAITextResponseRequest): Promise<OpenAITextResponse> {
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
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
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with status ${response.status}`);
  }

  const data = (await response.json()) as {
    output_text?: string;
  } & Record<string, unknown>;

  return {
    output_text: data.output_text ?? "",
    raw: data
  };
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

import { env } from "@/src/config/env";

export const defaultOpenAIModel = "gpt-5.2";

type OpenAITextResponseRequest = {
  input: string;
  model?: string;
  reasoningEffort?: "low" | "medium" | "high";
  apiKey?: string;
  fetchImpl?: typeof fetch;
};

type OpenAITextResponse = {
  output_text: string;
};

export async function requestOpenAITextResponse({
  input,
  model = defaultOpenAIModel,
  reasoningEffort,
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
      ...(reasoningEffort
        ? {
            reasoning: {
              effort: reasoningEffort
            }
          }
        : {})
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with status ${response.status}`);
  }

  const data = (await response.json()) as {
    output_text?: string;
  };

  return {
    output_text: data.output_text ?? ""
  };
}

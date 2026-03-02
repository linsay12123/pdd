import { env } from "@/src/config/env";

export const defaultOpenAIModel = "gpt-5.2";

type OpenAITextResponseRequest = {
  input: string;
  model?: string;
};

type OpenAITextResponse = {
  output_text: string;
};

export async function requestOpenAITextResponse({
  input,
  model = defaultOpenAIModel
}: OpenAITextResponseRequest): Promise<OpenAITextResponse> {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model,
      input
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

import "server-only";
import { env } from "@/src/config/env";
import { defaultOpenAIModel } from "@/src/lib/ai/openai-client";

export async function extractTextFromImageWithVision(
  imageBase64: string,
  filename: string
): Promise<string> {
  const apiKey = env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const extension = filename.split(".").pop()?.toLowerCase() ?? "png";
  const mimeType = extension === "jpg" || extension === "jpeg"
    ? "image/jpeg"
    : extension === "pdf"
      ? "image/png"
      : `image/${extension}`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: defaultOpenAIModel,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Extract ALL visible text from this image. Return ONLY the extracted text, preserving the original structure and formatting. If the image contains a scanned document, extract all text from it. If no text is found, respond with '[no text detected]'."
            },
            {
              type: "input_image",
              image_url: `data:${mimeType};base64,${imageBase64}`
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI vision request failed with status ${response.status}`);
  }

  const data = (await response.json()) as { output_text?: string };
  return data.output_text ?? "";
}

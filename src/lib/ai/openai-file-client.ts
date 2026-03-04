import "server-only";
import { env } from "@/src/config/env";

type OpenAIUserFileUploadInput = {
  filename: string;
  body: Buffer;
  contentType?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
};

type UploadedOpenAIFile = {
  id: string;
  filename: string;
};

export async function uploadOpenAIUserFile({
  filename,
  body,
  contentType = "application/octet-stream",
  apiKey = env.OPENAI_API_KEY,
  fetchImpl = fetch
}: OpenAIUserFileUploadInput): Promise<UploadedOpenAIFile> {
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const formData = new FormData();
  formData.append(
    "file",
    new Blob([new Uint8Array(body)], {
      type: contentType
    }),
    filename
  );
  formData.append("purpose", "user_data");

  const response = await fetchImpl("https://api.openai.com/v1/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: formData
  });

  if (!response.ok) {
    throw new Error(`OpenAI file upload failed with status ${response.status}`);
  }

  const data = (await response.json()) as {
    id?: string;
    filename?: string;
  };

  if (!data.id) {
    throw new Error("OpenAI file upload did not return a file id");
  }

  return {
    id: data.id,
    filename: data.filename ?? filename
  };
}

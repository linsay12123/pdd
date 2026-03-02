import { detectSupportedFileKind } from "./file-kind";

export async function extractTextFromUpload(file: File): Promise<string> {
  const fileKind = detectSupportedFileKind(file.name);

  if (fileKind === "txt" || fileKind === "md") {
    const text = await file.text();
    return text.trim();
  }

  return `[extraction pending for ${file.name}]`;
}

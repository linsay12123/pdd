export const supportedFileExtensions = [
  "txt",
  "md",
  "docx",
  "pdf",
  "ppt",
  "pptx"
] as const;

export type SupportedFileKind = (typeof supportedFileExtensions)[number];

export function detectSupportedFileKind(filename: string): SupportedFileKind {
  const extension = filename.split(".").pop()?.toLowerCase();

  if (!extension || !supportedFileExtensions.includes(extension as SupportedFileKind)) {
    throw new Error("Unsupported file type");
  }

  return extension as SupportedFileKind;
}

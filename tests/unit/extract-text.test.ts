import { describe, expect, it } from "vitest";
import {
  detectSupportedFileKind,
  supportedFileExtensions
} from "../../src/lib/files/file-kind";
import { extractTextFromUpload } from "../../src/lib/files/extract-text";

describe("file extraction", () => {
  it("lists the supported upload extensions", () => {
    expect(supportedFileExtensions).toEqual([
      "txt",
      "md",
      "docx",
      "pdf",
      "ppt",
      "pptx"
    ]);
  });

  it("detects supported file kinds", () => {
    expect(detectSupportedFileKind("brief.txt")).toBe("txt");
    expect(detectSupportedFileKind("notes.md")).toBe("md");
    expect(detectSupportedFileKind("slides.PPTX")).toBe("pptx");
  });

  it("rejects unsupported file kinds", () => {
    expect(() => detectSupportedFileKind("image.png")).toThrow(
      "Unsupported file type"
    );
  });

  it("extracts actual text for plain text files", async () => {
    const file = new File(["hello world"], "brief.txt", {
      type: "text/plain"
    });

    await expect(extractTextFromUpload(file)).resolves.toBe("hello world");
  });

  it("returns a non-empty extraction placeholder for binary office files", async () => {
    const file = new File(["binary"], "slides.pptx", {
      type: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    });

    const result = await extractTextFromUpload(file);

    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain("slides.pptx");
  });
});

import JSZip from "jszip";
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
      "pptx",
      "jpg",
      "jpeg",
      "png"
    ]);
  });

  it("detects supported file kinds", () => {
    expect(detectSupportedFileKind("brief.txt")).toBe("txt");
    expect(detectSupportedFileKind("notes.md")).toBe("md");
    expect(detectSupportedFileKind("slides.PPTX")).toBe("pptx");
  });

  it("rejects unsupported file kinds", () => {
    expect(() => detectSupportedFileKind("archive.zip")).toThrow(
      "Unsupported file type"
    );
  });

  it("detects image file kinds", () => {
    expect(detectSupportedFileKind("photo.jpg")).toBe("jpg");
    expect(detectSupportedFileKind("scan.jpeg")).toBe("jpeg");
    expect(detectSupportedFileKind("screenshot.png")).toBe("png");
  });

  it("returns image placeholder for image uploads", async () => {
    const file = new File([new Uint8Array(8)], "photo.jpg", {
      type: "image/jpeg"
    });
    const result = await extractTextFromUpload(file);
    expect(result).toBe("[image content: photo.jpg]");
  });

  it("extracts actual text for plain text files", async () => {
    const file = new File(["hello world"], "brief.txt", {
      type: "text/plain"
    });

    await expect(extractTextFromUpload(file)).resolves.toBe("hello world");
  });

  it("extracts text from docx files instead of returning a placeholder", async () => {
    const zip = new JSZip();

    zip.file(
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:r><w:t>Assignment brief</w:t></w:r></w:p>
          <w:p><w:r><w:t>Required word count 2500</w:t></w:r></w:p>
        </w:body>
      </w:document>`
    );

    const file = new File(
      [Buffer.from(await zip.generateAsync({ type: "uint8array" }))],
      "brief.docx",
      {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      }
    );

    const result = await extractTextFromUpload(file);

    expect(result).toContain("Assignment brief");
    expect(result).toContain("2500");
  });

  it("extracts text from pptx files instead of returning a placeholder", async () => {
    const zip = new JSZip();

    zip.file(
      "ppt/slides/slide1.xml",
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <p:cSld>
          <p:spTree>
            <p:sp>
              <p:txBody>
                <a:p><a:r><a:t>Lecture Slide One</a:t></a:r></a:p>
                <a:p><a:r><a:t>Critical theory overview</a:t></a:r></a:p>
              </p:txBody>
            </p:sp>
          </p:spTree>
        </p:cSld>
      </p:sld>`
    );

    const file = new File(
      [Buffer.from(await zip.generateAsync({ type: "uint8array" }))],
      "slides.pptx",
      {
        type: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      }
    );

    const result = await extractTextFromUpload(file);

    expect(result).toContain("Lecture Slide One");
    expect(result).toContain("Critical theory overview");
  });

  it("extracts visible text from simple pdf files", async () => {
    const pdfBytes = new TextEncoder().encode(`%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 55 >>
stream
BT
/F1 18 Tf
72 72 Td
(PDF extraction works) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000062 00000 n 
0000000117 00000 n 
0000000243 00000 n 
0000000348 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
418
%%EOF`);
    const file = new File([pdfBytes], "reading.pdf", {
      type: "application/pdf"
    });

    const result = await extractTextFromUpload(file);

    expect(result).toContain("PDF extraction works");
  });

  it("falls back to visible legacy strings for ppt files", async () => {
    const file = new File(
      [new Uint8Array(Buffer.from("Legacy PPT title\nKey bullet about governance", "utf8"))],
      "slides.ppt",
      {
        type: "application/vnd.ms-powerpoint"
      }
    );

    const result = await extractTextFromUpload(file);

    expect(result).toContain("Legacy PPT title");
    expect(result).toContain("governance");
  });
});

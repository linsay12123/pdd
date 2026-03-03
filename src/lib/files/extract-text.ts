import JSZip from "jszip";
import { PDFParse } from "pdf-parse";
import { detectSupportedFileKind } from "./file-kind";

const xmlTagPattern = /<[^>]+>/g;
const whitespacePattern = /\s+/g;

export async function extractTextFromUpload(file: File): Promise<string> {
  const fileKind = detectSupportedFileKind(file.name);

  if (fileKind === "txt" || fileKind === "md") {
    const text = await file.text();
    return text.trim();
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (fileKind === "docx") {
    return extractDocxText(buffer, file.name);
  }

  if (fileKind === "pptx") {
    return extractPptxText(buffer, file.name);
  }

  if (fileKind === "pdf") {
    return extractPdfText(buffer, file.name);
  }

  if (fileKind === "ppt") {
    return extractLegacyPptText(buffer, file.name);
  }

  return fallbackExtraction(file.name);
}

async function extractDocxText(buffer: Buffer, filename: string) {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const xmlFiles = Object.keys(zip.files)
      .filter((name) =>
        /^word\/(document|header\d+|footer\d+|footnotes|endnotes)\.xml$/i.test(name)
      )
      .sort();

    const blocks = await Promise.all(
      xmlFiles.map(async (name) => {
        const content = await zip.file(name)?.async("text");
        return extractTextFromXml(content ?? "");
      })
    );

    return normalizeExtractedText(blocks.join("\n"), filename);
  } catch {
    return fallbackExtraction(filename);
  }
}

async function extractPptxText(buffer: Buffer, filename: string) {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort((left, right) => compareNumericSuffix(left, right));
    const noteFiles = Object.keys(zip.files)
      .filter((name) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/i.test(name))
      .sort((left, right) => compareNumericSuffix(left, right));
    const xmlFiles = [...slideFiles, ...noteFiles];

    const blocks = await Promise.all(
      xmlFiles.map(async (name) => {
        const content = await zip.file(name)?.async("text");
        return extractTextFromXml(content ?? "");
      })
    );

    return normalizeExtractedText(blocks.join("\n"), filename);
  } catch {
    return fallbackExtraction(filename);
  }
}

async function extractPdfText(buffer: Buffer, filename: string) {
  try {
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    await parser.destroy();
    const extracted = normalizeExtractedText(parsed.text ?? "", filename);

    if (extracted !== fallbackExtraction(filename)) {
      return extracted;
    }
  } catch {
    // Fall through to the lightweight stream parser below.
  }

  const streamText = extractPdfStrings(buffer);
  return normalizeExtractedText(streamText, filename);
}

function extractLegacyPptText(buffer: Buffer, filename: string) {
  const asciiStrings = buffer
    .toString("latin1")
    .match(/[A-Za-z0-9][A-Za-z0-9 ,.;:()'"/+-]{4,}/g);
  const utf16Strings = buffer
    .toString("utf16le")
    .match(/[A-Za-z0-9][A-Za-z0-9 ,.;:()'"/+\-\n]{4,}/g);

  return normalizeExtractedText(
    [...(asciiStrings ?? []), ...(utf16Strings ?? [])].join("\n"),
    filename
  );
}

function extractTextFromXml(xml: string) {
  return decodeXmlEntities(xml)
    .replace(/<\/w:p>/g, "\n")
    .replace(/<\/a:p>/g, "\n")
    .replace(/<\/text:p>/g, "\n")
    .replace(xmlTagPattern, " ")
    .replace(whitespacePattern, " ")
    .trim();
}

function normalizeExtractedText(text: string, filename: string) {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return normalized || fallbackExtraction(filename);
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#xA;/gi, "\n");
}

function extractPdfStrings(buffer: Buffer) {
  const source = buffer.toString("latin1");
  const matches = [...source.matchAll(/\(([^()]*)\)\s*Tj/g)];

  if (!matches.length) {
    return "";
  }

  return matches
    .map((match) => match[1]?.replace(/\\([()\\])/g, "$1") ?? "")
    .join("\n");
}

function compareNumericSuffix(left: string, right: string) {
  const leftNumber = Number(left.match(/(\d+)(?=\.xml$)/i)?.[1] ?? 0);
  const rightNumber = Number(right.match(/(\d+)(?=\.xml$)/i)?.[1] ?? 0);

  return leftNumber - rightNumber;
}

function fallbackExtraction(filename: string) {
  return `[extraction pending for ${filename}]`;
}

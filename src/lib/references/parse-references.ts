const referencesHeadingPattern = /^#{0,2}\s*References\s*$/im;

export type ParsedReferenceEntry = {
  rawReference: string;
  detectedTitle?: string;
  detectedYear?: string;
  detectedDoi?: string;
  detectedUrl?: string;
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function extractYear(reference: string) {
  const match = reference.match(/\((\d{4})\)/);
  return match?.[1];
}

function extractDoi(reference: string) {
  const doiUrlMatch = reference.match(/https?:\/\/doi\.org\/([^\s)]+)/i);
  if (doiUrlMatch) {
    return doiUrlMatch[1].replace(/[.]+$/, "");
  }

  const doiMatch = reference.match(/\b10\.\d{4,9}\/[^\s)]+/i);
  return doiMatch?.[0]?.replace(/[.]+$/, "");
}

function extractUrl(reference: string) {
  const urlMatch = reference.match(/https?:\/\/[^\s)]+/i);
  return urlMatch?.[0]?.replace(/[.]+$/, "");
}

function extractTitle(reference: string) {
  const yearMatch = reference.match(/\(\d{4}\)\.\s*([^.]*)\./);
  if (yearMatch?.[1]) {
    return normalizeWhitespace(yearMatch[1]);
  }

  const sentenceParts = reference
    .split(".")
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);

  return sentenceParts[1] || sentenceParts[0];
}

export function parseReferenceEntry(rawReference: string): ParsedReferenceEntry {
  const normalizedReference = normalizeWhitespace(rawReference);

  return {
    rawReference: normalizedReference,
    detectedTitle: extractTitle(normalizedReference),
    detectedYear: extractYear(normalizedReference),
    detectedDoi: extractDoi(normalizedReference),
    detectedUrl: extractUrl(normalizedReference)
  };
}

export function parseReferencesSection(markdown: string): ParsedReferenceEntry[] {
  const [, referencesBlock = ""] = markdown.split(referencesHeadingPattern);
  const normalizedBlock = referencesBlock.trim();

  if (!normalizedBlock) {
    return [];
  }

  return normalizedBlock
    .split(/\n\s*\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => parseReferenceEntry(entry));
}

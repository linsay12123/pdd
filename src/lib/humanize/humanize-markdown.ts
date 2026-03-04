export const humanizeSectionBreakTokenPrefix = "<<<PDD_SECTION_BREAK_";

export type HumanizeSubmission = {
  title: string;
  sectionHeadings: string[];
  sectionBodies: string[];
  references: string;
  bodyForHumanize: string;
};

export type HumanizedBodyValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export function buildHumanizeSubmission(draftMarkdown: string): HumanizeSubmission {
  const normalized = normalizeDraft(draftMarkdown);
  const lines = normalized.split("\n");
  const sectionHeadings: string[] = [];
  const sectionBodies: string[] = [];
  let title = "";
  let references = "";
  let currentHeading = "";
  let currentLines: string[] = [];
  let readingReferences = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (!title && line.startsWith("# ")) {
      title = line.slice(2).trim();
      continue;
    }

    if (/^##\s+references\s*$/i.test(line)) {
      flushCurrentSection();
      readingReferences = true;
      continue;
    }

    if (!readingReferences && line.startsWith("## ")) {
      flushCurrentSection();
      currentHeading = line.slice(3).trim();
      currentLines = [];
      continue;
    }

    if (readingReferences) {
      references = references ? `${references}\n${line}` : line;
      continue;
    }

    if (!currentHeading) {
      continue;
    }

    currentLines.push(line);
  }

  flushCurrentSection();

  const bodyForHumanize = sectionBodies
    .map((body, index) => {
      if (index === sectionBodies.length - 1) {
        return body;
      }

      return `${body}\n\n${buildSectionBreakToken(index + 1)}`;
    })
    .join("\n\n")
    .trim();

  return {
    title,
    sectionHeadings,
    sectionBodies,
    references: references.trim(),
    bodyForHumanize
  };

  function flushCurrentSection() {
    if (!currentHeading) {
      return;
    }

    sectionHeadings.push(currentHeading);
    sectionBodies.push(currentLines.join("\n").trim());
    currentHeading = "";
    currentLines = [];
  }
}

export function rebuildDraftWithHumanizedBody(input: {
  original: HumanizeSubmission;
  humanizedBody: string;
}) {
  const bodySections = splitHumanizedBody(
    input.humanizedBody,
    input.original.sectionHeadings.length
  );

  const parts: string[] = [];

  if (input.original.title) {
    parts.push(`# ${input.original.title}`);
  }

  input.original.sectionHeadings.forEach((heading, index) => {
    parts.push(`## ${heading}`);
    const body = bodySections[index]?.trim();
    if (body) {
      parts.push(body);
    }
  });

  if (input.original.references) {
    parts.push("## References");
    parts.push(input.original.references);
  }

  return parts.join("\n\n").trim();
}

export function validateHumanizedBody(input: {
  originalBody: string;
  humanizedBody: string;
}): HumanizedBodyValidationResult {
  const original = normalizeComparableText(input.originalBody);
  const next = normalizeComparableText(input.humanizedBody);

  if (!next) {
    return { ok: false, reason: "EMPTY_OUTPUT" };
  }

  if (next === original) {
    return { ok: false, reason: "UNCHANGED_OUTPUT" };
  }

  const originalWordCount = countWords(original);
  const nextWordCount = countWords(next);

  if (nextWordCount < Math.ceil(originalWordCount * 0.6)) {
    return { ok: false, reason: "TOO_SHORT" };
  }

  if (nextWordCount > Math.ceil(originalWordCount * 1.5)) {
    return { ok: false, reason: "TOO_LONG" };
  }

  return { ok: true };
}

export function draftToDocxContent(draftMarkdown: string) {
  const submission = buildHumanizeSubmission(draftMarkdown);

  return {
    title: submission.title || "Draft",
    sections: submission.sectionHeadings.map((heading, index) => ({
      heading,
      paragraphs: submission.sectionBodies[index]
        ?.split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean) ?? []
    })),
    references: submission.references
      .split("\n")
      .map((reference) => reference.trim())
      .filter(Boolean)
  };
}

export function splitHumanizedBody(humanizedBody: string, expectedSections: number) {
  if (expectedSections <= 1) {
    return [humanizedBody.trim()];
  }

  const tokens = Array.from({ length: expectedSections - 1 }, (_, index) =>
    buildSectionBreakToken(index + 1)
  );
  const normalized = normalizeDraft(humanizedBody);
  const sections: string[] = [];
  let remaining = normalized;

  for (const token of tokens) {
    const tokenIndex = remaining.indexOf(token);
    if (tokenIndex === -1) {
      throw new Error("HUMANIZE_SECTION_BREAK_MISSING");
    }

    sections.push(remaining.slice(0, tokenIndex).trim());
    remaining = remaining.slice(tokenIndex + token.length).trim();
  }

  sections.push(remaining.trim());
  return sections;
}

function buildSectionBreakToken(index: number) {
  return `${humanizeSectionBreakTokenPrefix}${index}>>>`;
}

function normalizeDraft(draftMarkdown: string) {
  return draftMarkdown.replace(/\r\n/g, "\n").trim();
}

function normalizeComparableText(text: string) {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function countWords(text: string) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

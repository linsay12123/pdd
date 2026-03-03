import type { HumanizeProvider } from "./humanize-provider";

export const maxHumanizeChunkLength = 1800;

export type HumanizeSection = {
  heading: string;
  body: string;
  chunks: string[];
};

export type ParsedHumanizeDraft = {
  title: string;
  sections: HumanizeSection[];
  references: string;
};

export function splitDraftForHumanize(
  draftMarkdown: string,
  maxChunkLength = maxHumanizeChunkLength
): ParsedHumanizeDraft {
  const normalized = normalizeDraft(draftMarkdown);
  const sections: Array<{ heading: string; bodyLines: string[] }> = [];
  let title = "";
  let currentHeading = "";
  let currentBodyLines: string[] = [];

  for (const line of normalized.split("\n")) {
    if (!title && line.startsWith("# ")) {
      title = line.slice(2).trim();
      continue;
    }

    if (line.match(/^#{0,2}\s*References\s*$/i)) {
      if (currentHeading) {
        sections.push({
          heading: currentHeading,
          bodyLines: [...currentBodyLines]
        });
      }

      currentHeading = "References";
      currentBodyLines = [];
      continue;
    }

    if (line.startsWith("## ")) {
      if (currentHeading) {
        sections.push({
          heading: currentHeading,
          bodyLines: [...currentBodyLines]
        });
      }

      currentHeading = line.slice(3).trim();
      currentBodyLines = [];
      continue;
    }

    currentBodyLines.push(line);
  }

  if (currentHeading) {
    sections.push({
      heading: currentHeading,
      bodyLines: [...currentBodyLines]
    });
  }

  const articleSections: HumanizeSection[] = [];
  let references = "";

  for (const section of sections) {
    const body = section.bodyLines.join("\n").trim();

    if (section.heading.toLowerCase() === "references") {
      references = body;
      continue;
    }

    articleSections.push({
      heading: section.heading,
      body,
      chunks: splitTextIntoChunks(body, maxChunkLength)
    });
  }

  return {
    title,
    sections: articleSections,
    references
  };
}

export function splitTextIntoChunks(
  text: string,
  maxChunkLength = maxHumanizeChunkLength
) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (!paragraphs.length) {
    return [];
  }

  const chunks: string[] = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChunkLength) {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = "";
      }

      chunks.push(...splitLongParagraph(paragraph, maxChunkLength));
      continue;
    }

    const candidate = currentChunk
      ? `${currentChunk}\n\n${paragraph}`
      : paragraph;

    if (candidate.length <= maxChunkLength) {
      currentChunk = candidate;
      continue;
    }

    chunks.push(currentChunk);
    currentChunk = paragraph;
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

export function draftToDocxContent(draftMarkdown: string) {
  const parsed = splitDraftForHumanize(draftMarkdown);

  return {
    title: parsed.title || "Humanized Draft",
    sections: parsed.sections.map((section) => ({
      heading: section.heading,
      paragraphs: section.body
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
    })),
    references: parsed.references
      .split("\n")
      .map((reference) => reference.trim())
      .filter(Boolean)
  };
}

export async function humanizeDraft(
  draftMarkdown: string,
  provider: HumanizeProvider
): Promise<string> {
  const parsed = splitDraftForHumanize(draftMarkdown);
  const nextSections: HumanizeSection[] = [];

  for (const section of parsed.sections) {
    const rewrittenChunks: string[] = [];

    for (const chunk of section.chunks) {
      const result = await provider.rewriteChunk({ chunk });
      rewrittenChunks.push(result.rewrittenText);
    }

    nextSections.push({
      ...section,
      body: rewrittenChunks.join("\n\n").trim(),
      chunks: rewrittenChunks
    });
  }

  return buildDraftMarkdown({
    title: parsed.title,
    sections: nextSections,
    references: parsed.references
  });
}

function buildDraftMarkdown(parsed: ParsedHumanizeDraft) {
  const parts: string[] = [];

  if (parsed.title) {
    parts.push(`# ${parsed.title}`);
  }

  for (const section of parsed.sections) {
    parts.push(`## ${section.heading}`);

    if (section.body) {
      parts.push(section.body);
    }
  }

  if (parsed.references) {
    parts.push("## References");
    parts.push(parsed.references);
  }

  return parts.join("\n\n").trim();
}

function normalizeDraft(draftMarkdown: string) {
  return draftMarkdown.replace(/\r\n/g, "\n").trim();
}

function splitLongParagraph(paragraph: string, maxChunkLength: number) {
  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < paragraph.length) {
    chunks.push(paragraph.slice(startIndex, startIndex + maxChunkLength));
    startIndex += maxChunkLength;
  }

  return chunks;
}

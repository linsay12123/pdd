const outlineSectionTitles = [
  "Introduction",
  "Context and Scope",
  "Core Analysis",
  "Evidence and Discussion",
  "Strategic Implications",
  "Recommendations",
  "Conclusion"
] as const;

export type OutlineSection = {
  title: string;
  summary: string;
  bulletPoints: string[];
};

export type OutlineScaffold = {
  articleTitle: string;
  targetWordCount: number;
  citationStyle: string;
  sections: OutlineSection[];
  chineseMirrorPending: boolean;
};

type OutlineScaffoldInput = {
  topic: string;
  targetWordCount: number;
  citationStyle: string;
  chapterCountOverride?: number | null;
  shorterOutline?: boolean;
};

export function calculateDefaultChapterCount(targetWordCount: number) {
  return Math.max(1, Math.ceil(targetWordCount / 500));
}

export function determineOutlineBulletCount(
  targetWordCount: number,
  shorterOutline = false
) {
  if (shorterOutline) {
    return 3;
  }

  if (targetWordCount <= 1500) {
    return 3;
  }

  if (targetWordCount <= 2500) {
    return 4;
  }

  return 5;
}

function pickSectionTitle(index: number) {
  return outlineSectionTitles[index] ?? `Section ${index + 1}`;
}

function buildSectionBulletPoints(title: string, count: number) {
  return Array.from({ length: count }, (_, index) => {
    return `${title} focus point ${index + 1}`;
  });
}

export function buildOutlineScaffold({
  topic,
  targetWordCount,
  citationStyle,
  chapterCountOverride,
  shorterOutline = false
}: OutlineScaffoldInput): OutlineScaffold {
  const sectionCount = chapterCountOverride || calculateDefaultChapterCount(targetWordCount);
  const bulletCount = determineOutlineBulletCount(
    targetWordCount,
    shorterOutline
  );

  const sections = Array.from({ length: sectionCount }, (_, index) => {
    const title = pickSectionTitle(index);

    return {
      title,
      summary: `${title} will explain how ${topic.toLowerCase()} develops in this section.`,
      bulletPoints: buildSectionBulletPoints(title, bulletCount)
    };
  });

  return {
    articleTitle: `${topic}: A Structured Analysis`,
    targetWordCount,
    citationStyle,
    sections,
    chineseMirrorPending: true
  };
}

export function buildGenerateOutlinePrompt(
  input: OutlineScaffoldInput & { specialRequirements?: string }
) {
  const scaffold = buildOutlineScaffold(input);

  return [
    "Generate an English outline for a full academic article.",
    "Return a clear article title, short section titles, a one-line summary per section, and 3 to 5 bullets per section.",
    "Also produce a Chinese mirror version when possible, but the English outline must remain the primary output.",
    "",
    `TOPIC: ${input.topic}`,
    `TARGET_WORD_COUNT: ${input.targetWordCount}`,
    `CITATION_STYLE: ${input.citationStyle}`,
    `SECTION_COUNT: ${scaffold.sections.length}`,
    `SPECIAL_REQUIREMENTS: ${input.specialRequirements || "(none)"}`
  ].join("\n");
}

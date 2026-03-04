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
  chineseMirror?: {
    articleTitle: string;
    sections: OutlineSection[];
  } | null;
};

type OutlineScaffoldInput = {
  topic: string;
  targetWordCount: number;
  citationStyle: string;
  chapterCountOverride?: number | null;
  shorterOutline?: boolean;
};

export type GenerateOutlineInput = OutlineScaffoldInput & {
  mustAnswer?: string[];
  gradingPriorities?: string[];
  specialRequirements?: string;
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

export function buildGenerateOutlinePrompt(input: GenerateOutlineInput) {
  const sectionCount =
    input.chapterCountOverride || calculateDefaultChapterCount(input.targetWordCount);
  const bulletCount = determineOutlineBulletCount(
    input.targetWordCount,
    input.shorterOutline
  );

  return [
    "Generate an academic article outline. Return ONLY valid JSON (no markdown fences, no explanation).",
    "",
    "Required JSON structure:",
    "{",
    '  "articleTitle": "<a specific, meaningful title for the article>",',
    '  "sections": [',
    "    {",
    '      "title": "<short section title, 2-6 words>",',
    '      "summary": "<one sentence describing what this section will cover>",',
    '      "bulletPoints": ["<specific point 1>", "<specific point 2>", ...]',
    "    }",
    "  ]",
    "}",
    "",
    "Requirements:",
    `- TOPIC: ${input.topic}`,
    `- TARGET_WORD_COUNT: ${input.targetWordCount}`,
    `- CITATION_STYLE: ${input.citationStyle}`,
    `- SECTION_COUNT: exactly ${sectionCount} sections`,
    `- BULLET_POINTS_PER_SECTION: ${bulletCount}`,
    `- MUST_ANSWER: ${input.mustAnswer?.length ? input.mustAnswer.join("; ") : "(none)"}`,
    `- GRADING_PRIORITIES: ${input.gradingPriorities?.length ? input.gradingPriorities.join("; ") : "(none)"}`,
    `- SPECIAL_REQUIREMENTS: ${input.specialRequirements || "(none)"}`,
    "",
    "Rules:",
    "- The articleTitle must be specific to the topic, not generic.",
    "- Each section title must be a short heading (2-6 words), NOT a full sentence.",
    "- Each summary must be a real sentence describing what will be argued or analyzed.",
    "- Each bullet point must be a specific content guidance point, not a placeholder.",
    "- The outline must address all MUST_ANSWER items across the sections.",
    "- The first section should introduce the topic and the last section should conclude.",
    "- All text must be in English."
  ].join("\n");
}

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
};

export type GenerateOutlineInput = OutlineScaffoldInput & {
  mustAnswer?: string[];
  gradingPriorities?: string[];
  specialRequirements?: string;
  feedback?: string;
  previousOutline?: OutlineScaffold | null;
};

export function calculateDefaultChapterCount(targetWordCount: number) {
  return Math.max(1, Math.ceil(targetWordCount / 500));
}

export function determineOutlineBulletCount(
  targetWordCount: number
) {
  if (targetWordCount <= 1500) {
    return 3;
  }

  if (targetWordCount <= 2500) {
    return 4;
  }

  return 5;
}

export function buildGenerateOutlinePrompt(input: GenerateOutlineInput) {
  const sectionCount =
    input.chapterCountOverride ||
    input.previousOutline?.sections.length ||
    calculateDefaultChapterCount(input.targetWordCount);
  const bulletCount = determineOutlineBulletCount(input.targetWordCount);

  const lines = [
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
  ];

  if (input.feedback) {
    lines.push(`- USER_REVISION_FEEDBACK: ${input.feedback}`);
  }

  if (input.previousOutline) {
    lines.push(
      `- PREVIOUS_OUTLINE_JSON: ${JSON.stringify({
        articleTitle: input.previousOutline.articleTitle,
        sections: input.previousOutline.sections
      })}`
    );
  }

  if (input.feedback || input.previousOutline) {
    lines.push("");
    lines.push(
      "IMPORTANT: This is a revision task. Revise the previous outline instead of rewriting a generic template from scratch."
    );
    lines.push(
      "You MUST follow USER_REVISION_FEEDBACK exactly as written. Do not ignore or simplify it."
    );
  }

  lines.push(
    "",
    "Rules:",
    "- The articleTitle must be specific to the topic, not generic.",
    "- Each section title must be a short heading (2-6 words), NOT a full sentence.",
    "- Each summary must be a real sentence describing what will be argued or analyzed.",
    "- Each summary must clearly state the concrete content or argument for that section.",
    "- Each bullet point must be a specific content guidance point, not a placeholder.",
    "- Never use placeholders such as 'focus point 1', 'focus point 2', or similarly generic wording.",
    "- The outline must address all MUST_ANSWER items across the sections.",
    "- The first section should introduce the topic and the last section should conclude.",
    "- All text must be in English."
  );

  return lines.join("\n");
}

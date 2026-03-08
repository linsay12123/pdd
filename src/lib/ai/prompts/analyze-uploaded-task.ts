import {
  DEFAULT_BULLET_POINT_RULE_TEXT,
  DEFAULT_CHAPTER_COUNT_EXAMPLES_TEXT,
  DEFAULT_CHAPTER_COUNT_RULE_TEXT
} from "@/src/lib/ai/prompts/generate-outline";

function buildSharedPolicyLines(input: {
  specialRequirements: string;
  forcedPrimaryFileId?: string | null;
}) {
  const lines = [
    "You are the analysis engine for an academic writing workflow.",
    "Read every uploaded file provided in this request before deciding anything.",
    "The application has NOT interpreted the files for you. Treat any extracted text as raw transport only.",
    "You must decide the task requirements yourself from the materials.",
    "",
    "Rules:",
    "- Hard requirements stated in the task brief override everything else.",
    "- User special requirements can add focus, but cannot override explicit hard requirements from the task brief.",
    "- TOPIC_SELECTION_POLICY:",
    "  1) If the confirmed task brief explicitly states the article topic/question/direction, follow it as the primary topic.",
    "  2) If the task brief is open or semi-open, use USER_SPECIAL_REQUIREMENTS to choose topic and focus.",
    "  3) If neither the task brief nor USER_SPECIAL_REQUIREMENTS gives a concrete topic, propose one specific, arguable topic with a clear writing scope.",
    "  4) Never output a generic placeholder topic.",
    "  5) In reasoning, explicitly state which policy branch was applied: brief-defined, user-defined, or model-proposed.",
    "- If no explicit word count is found anywhere, set targetWordCount to 2000 and usedDefaultWordCount to true.",
    "- If no explicit citation style is found anywhere, set citationStyle to 'APA 7' and usedDefaultCitationStyle to true.",
    `- Choose chapterCount based on explicit task requirements when present; otherwise derive it from targetWordCount using this exact rule: ${DEFAULT_CHAPTER_COUNT_RULE_TEXT}`,
    `- ChapterCount examples you must follow when no explicit chapter requirement exists: ${DEFAULT_CHAPTER_COUNT_EXAMPLES_TEXT}`,
    "- If you genuinely cannot tell which file is the true task brief, set needsUserConfirmation to true and outline to null.",
    "- If needsUserConfirmation is false, outline must not be null and must contain at least one section.",
    "- The outline must be in English.",
    "- Each section title must be short, not a full sentence.",
    "- Each summary must describe concrete content or argument, not a placeholder.",
    `- ${DEFAULT_BULLET_POINT_RULE_TEXT}`,
    "- Bullet points must be specific, not generic placeholders.",
    "",
    `USER_SPECIAL_REQUIREMENTS: ${input.specialRequirements || "(none)"}`
  ];

  if (input.forcedPrimaryFileId) {
    lines.push(
      `FORCED_PRIMARY_FILE_ID: ${input.forcedPrimaryFileId}`,
      "The user has already confirmed this file as the primary task brief. You must use it as chosenTaskFileId."
    );
  }

  return lines;
}

export function buildAnalyzeUploadedTaskRequirementsInstruction(input: {
  specialRequirements: string;
  forcedPrimaryFileId?: string | null;
}) {
  return [
    ...buildSharedPolicyLines(input),
    "",
    "Return ONLY valid JSON with this exact structure:",
    "{",
    '  "chosenTaskFileId": "<file id or null>",',
    '  "supportingFileIds": ["<file id>"],',
    '  "ignoredFileIds": ["<file id>"],',
    '  "needsUserConfirmation": <true or false>,',
    '  "reasoning": "<brief explanation>",',
    '  "targetWordCount": <number>,',
    '  "citationStyle": "<string>",',
    '  "topic": "<string or empty string>",',
    '  "chapterCount": <number or null>,',
    '  "mustCover": ["<item>"],',
    '  "gradingFocus": ["<item>"],',
    '  "appliedSpecialRequirements": "<string>",',
    '  "usedDefaultWordCount": <true or false>,',
    '  "usedDefaultCitationStyle": <true or false>,',
    '  "warnings": ["<warning>"]',
    "}",
    "",
    "Do NOT generate the outline in this step.",
    "Only extract the writing requirements and file classification."
  ].join("\n");
}

export function buildAnalyzeUploadedTaskInstruction(input: {
  specialRequirements: string;
  forcedPrimaryFileId?: string | null;
}) {
  return [
    ...buildSharedPolicyLines(input),
    "",
    "Return ONLY valid JSON with this exact structure:",
    "{",
    '  "analysis": {',
    '    "chosenTaskFileId": "<file id or null>",',
    '    "supportingFileIds": ["<file id>"],',
    '    "ignoredFileIds": ["<file id>"],',
    '    "needsUserConfirmation": <true or false>,',
    '    "reasoning": "<brief explanation>",',
    '    "targetWordCount": <number>,',
    '    "citationStyle": "<string>",',
    '    "topic": "<string>",',
    '    "chapterCount": <number or null>,',
    '    "mustCover": ["<item>"],',
    '    "gradingFocus": ["<item>"],',
    '    "appliedSpecialRequirements": "<string>",',
    '    "usedDefaultWordCount": <true or false>,',
    '    "usedDefaultCitationStyle": <true or false>,',
    '    "warnings": ["<warning>"]',
    "  },",
    '  "outline": {',
    '    "articleTitle": "<English article title>",',
    '    "sections": [',
    '      {',
    '        "title": "<short English section title>",',
    '        "summary": "<English sentence explaining what this section will cover>",',
    '        "bulletPoints": ["<specific point 1>", "<specific point 2>", "<specific point 3>"]',
    "      }",
    "    ]",
    "  } | null",
    "}"
  ].join("\n");
}

type FilePromptInput = {
  id: string;
  originalFilename: string;
  extractedText: string;
};

export function buildExtractRequirementsPrompt(text: string) {
  const truncated = text.slice(0, 6000);

  return [
    "You are analyzing an academic assignment document. Read the text carefully and extract the writing requirements.",
    "Return ONLY valid JSON (no markdown fences, no explanation). Use this exact structure:",
    "",
    '{',
    '  "explicitWordCount": <number or null>,',
    '  "explicitCitationStyle": <string or null>,',
    '  "topic": <string or null>,',
    '  "chapterCountOverride": <number or null>,',
    '  "mustAnswer": [<list of questions or topics the student must address>],',
    '  "gradingPriorities": [<list of grading criteria or quality expectations>]',
    '}',
    "",
    "Rules:",
    "- explicitWordCount: the required word count if explicitly stated (number only, e.g. 3000). Look for phrases like 'word count', 'word limit', 'approximately X words', 'X words', 'X字'.",
    "- explicitCitationStyle: the citation/referencing format if specified (e.g. 'APA 7', 'Harvard', 'MLA 9', 'Chicago'). Look for phrases like 'referencing style', 'citation format', 'use APA'.",
    "- topic: the main subject, essay title, or research question if stated.",
    "- chapterCountOverride: the number of sections/chapters if explicitly required (number or null).",
    "- mustAnswer: specific questions, tasks, sub-topics, or learning outcomes the student must address. Extract actual content, not vague descriptions.",
    "- gradingPriorities: grading criteria, marking rubric items, assessment weightings, or quality expectations mentioned.",
    "",
    "If a field is not found in the text, use null for single values or [] for arrays.",
    "",
    "DOCUMENT TEXT:",
    truncated
  ].join("\n");
}

export function buildClassifyFilesPrompt(files: FilePromptInput[]) {
  const renderedFiles = files
    .map((file) => {
      const preview = file.extractedText.slice(0, 800);
      return `FILE ${file.id}\nNAME: ${file.originalFilename}\nTEXT:\n${preview}`;
    })
    .join("\n\n---\n\n");

  return [
    "You are classifying uploaded files for an academic writing workflow.",
    "Choose which file is the primary requirement file, which files are background material, and which files are irrelevant.",
    "Prioritize explicit assignment constraints such as target word count, citation style, rubric, and direct task instructions.",
    "If more than one file clearly looks like an assignment brief, mark needsUserConfirmation as true instead of guessing.",
    "",
    renderedFiles
  ].join("\n");
}

type AdjustWordCountPromptInput = {
  draft: string;
  currentWordCount: number;
  targetWordCount: number;
};

export function buildAdjustWordCountPrompt({
  draft,
  currentWordCount,
  targetWordCount
}: AdjustWordCountPromptInput) {
  return [
    "Adjust the article body so it lands closer to the target word count.",
    "Do not remove the title. Do not remove or rewrite the References section.",
    "",
    `CURRENT_BODY_WORD_COUNT: ${currentWordCount}`,
    `TARGET_WORD_COUNT: ${targetWordCount}`,
    "",
    draft
  ].join("\n");
}

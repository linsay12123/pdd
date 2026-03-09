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
    "Adjust only the main article body so it lands within the target word count range.",
    "Do not remove the title.",
    "Do not remove or rewrite the References section.",
    "References do not count toward the target body word count.",
    "The final body word count must land within plus or minus 10 words of the target word count.",
    "",
    `CURRENT_BODY_WORD_COUNT: ${currentWordCount}`,
    `TARGET_WORD_COUNT: ${targetWordCount}`,
    "",
    draft
  ].join("\n");
}

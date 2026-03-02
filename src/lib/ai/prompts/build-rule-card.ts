type RuleCardPromptInput = {
  taskHints: Record<string, unknown>;
  backgroundHints: Record<string, unknown>;
  userSpecialRequirements: string;
};

export function buildRuleCardPrompt({
  taskHints,
  backgroundHints,
  userSpecialRequirements
}: RuleCardPromptInput) {
  return [
    "Build a writing rule card for an English academic article.",
    "Use explicit task requirements first, then user special requirements, then useful background hints, then defaults.",
    "Defaults are 2000 words and APA 7 when explicit task requirements are missing.",
    "",
    `TASK_HINTS: ${JSON.stringify(taskHints)}`,
    `BACKGROUND_HINTS: ${JSON.stringify(backgroundHints)}`,
    `USER_SPECIAL_REQUIREMENTS: ${userSpecialRequirements || "(none)"}`
  ].join("\n");
}

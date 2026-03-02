import { buildRuleCardPrompt } from "@/src/lib/ai/prompts/build-rule-card";
import { requestOpenAITextResponse } from "@/src/lib/ai/openai-client";
import type { PrimaryTaskHints } from "./classify-files";

export type BackgroundRuleHints = {
  suggestedWordCount?: number;
  suggestedCitationStyle?: string;
  topicHints?: string[];
  mustAnswer?: string[];
  gradingPriorities?: string[];
};

export type WritingRuleCard = {
  topic: string;
  targetWordCount: number;
  citationStyle: string;
  chapterCountOverride: number | null;
  mustAnswer: string[];
  gradingPriorities: string[];
  specialRequirements: string;
};

type BuildInitialRuleCardInput = {
  primaryTaskHints: PrimaryTaskHints;
  backgroundHints: BackgroundRuleHints;
  userSpecialRequirements: string;
};

const DEFAULT_WORD_COUNT = 2000;
const DEFAULT_CITATION_STYLE = "APA 7";
const DEFAULT_TOPIC = "General Academic Essay";

function mergeUnique(primary: string[] = [], secondary: string[] = []) {
  return [...new Set([...primary, ...secondary].filter(Boolean))];
}

export function buildInitialRuleCard({
  primaryTaskHints,
  backgroundHints,
  userSpecialRequirements
}: BuildInitialRuleCardInput): WritingRuleCard {
  return {
    topic:
      primaryTaskHints.topic ||
      backgroundHints.topicHints?.find(Boolean) ||
      DEFAULT_TOPIC,
    targetWordCount:
      primaryTaskHints.explicitWordCount ||
      backgroundHints.suggestedWordCount ||
      DEFAULT_WORD_COUNT,
    citationStyle:
      primaryTaskHints.explicitCitationStyle ||
      backgroundHints.suggestedCitationStyle ||
      DEFAULT_CITATION_STYLE,
    chapterCountOverride: primaryTaskHints.chapterCountOverride ?? null,
    mustAnswer: mergeUnique(
      primaryTaskHints.mustAnswer,
      backgroundHints.mustAnswer
    ),
    gradingPriorities: mergeUnique(
      primaryTaskHints.gradingPriorities,
      backgroundHints.gradingPriorities
    ),
    specialRequirements: userSpecialRequirements.trim()
  };
}

export async function requestRuleCardDraft(input: BuildInitialRuleCardInput) {
  const prompt = buildRuleCardPrompt({
    taskHints: input.primaryTaskHints,
    backgroundHints: input.backgroundHints,
    userSpecialRequirements: input.userSpecialRequirements
  });

  return requestOpenAITextResponse({
    input: prompt
  });
}

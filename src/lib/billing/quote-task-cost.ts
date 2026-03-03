export type PricingTier = {
  maxWords: number;
  quotaCost: number;
};

export const GENERATION_COST_PER_1000_WORDS = 230;
export const HUMANIZE_COST_PER_1000_WORDS = 250;

export function quoteGenerationTaskCost(
  targetWordCount: number,
  _pricing?: PricingTier[]
) {
  const units = Math.max(1, Math.ceil(targetWordCount / 1000));
  return units * GENERATION_COST_PER_1000_WORDS;
}

export function quoteHumanizeTaskCost(
  bodyWordCount: number,
  _pricing?: PricingTier[]
) {
  const units = Math.max(1, Math.ceil(bodyWordCount / 1000));
  return units * HUMANIZE_COST_PER_1000_WORDS;
}

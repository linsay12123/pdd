export type PricingTier = {
  maxWords: number;
  quotaCost: number;
};

export const GENERATION_TASK_QUOTA_COST = 500;
export const HUMANIZE_TASK_QUOTA_COST = 500;

export function quoteGenerationTaskCost(
  _targetWordCount: number,
  _pricing?: PricingTier[]
) {
  return GENERATION_TASK_QUOTA_COST;
}

export function quoteHumanizeTaskCost(
  _targetWordCount: number,
  _pricing?: PricingTier[]
) {
  return HUMANIZE_TASK_QUOTA_COST;
}

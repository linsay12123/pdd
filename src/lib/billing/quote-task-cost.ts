export type PricingTier = {
  maxWords: number;
  quotaCost: number;
};

const defaultGenerationPricing: PricingTier[] = [
  { maxWords: 1000, quotaCost: 12 },
  { maxWords: 2000, quotaCost: 20 },
  { maxWords: 3000, quotaCost: 28 },
  { maxWords: 5000, quotaCost: 44 }
];

const defaultHumanizePricing: PricingTier[] = [
  { maxWords: 1000, quotaCost: 6 },
  { maxWords: 2000, quotaCost: 10 },
  { maxWords: 3000, quotaCost: 14 },
  { maxWords: 5000, quotaCost: 22 }
];

export function quoteGenerationTaskCost(
  targetWordCount: number,
  pricing = defaultGenerationPricing
) {
  return quoteByTier(targetWordCount, pricing);
}

export function quoteHumanizeTaskCost(
  targetWordCount: number,
  pricing = defaultHumanizePricing
) {
  return quoteByTier(targetWordCount, pricing);
}

function quoteByTier(targetWordCount: number, pricing: PricingTier[]) {
  const normalizedWords = Math.max(1, targetWordCount);
  const matchedTier = pricing.find((tier) => normalizedWords <= tier.maxWords);

  if (matchedTier) {
    return matchedTier.quotaCost;
  }

  const highestTier = pricing[pricing.length - 1];

  if (!highestTier) {
    throw new Error("Pricing tiers are required");
  }

  const overflowWords = normalizedWords - highestTier.maxWords;
  const overflowBlocks = Math.ceil(overflowWords / 500);
  const fallbackStep = Math.max(
    1,
    Math.ceil(highestTier.quotaCost / Math.ceil(highestTier.maxWords / 500))
  );

  return highestTier.quotaCost + overflowBlocks * fallbackStep;
}

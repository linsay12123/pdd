import { quoteGenerationTaskCost } from "@/src/lib/billing/quote-task-cost";

export function resolveGenerationTaskQuotaCost(targetWordCount: number) {
  return quoteGenerationTaskCost(targetWordCount);
}

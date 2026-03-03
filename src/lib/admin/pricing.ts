import {
  GENERATION_COST_PER_1000_WORDS,
  HUMANIZE_COST_PER_1000_WORDS
} from "@/src/lib/billing/quote-task-cost";

export type AdminPricingRule = {
  id: "generation" | "humanize";
  title: string;
  costPer1000Words: number;
  description: string;
  note: string;
};

export function getAdminPricingRules(): AdminPricingRule[] {
  return [
    {
      id: "generation",
      title: "生成文章",
      costPer1000Words: GENERATION_COST_PER_1000_WORDS,
      description: "用户每次点击开始写作，系统按目标字数计算积分并冻结，任务完成后正式结算。",
      note: "按字数计费：每 1000 字收取固定积分，不足 1000 字按 1000 字计算。"
    },
    {
      id: "humanize",
      title: "自动降AI",
      costPer1000Words: HUMANIZE_COST_PER_1000_WORDS,
      description: "用户点击自动降AI时，系统按正文字数计算积分并冻结，处理完成后正式结算。",
      note: "按字数计费：每 1000 字收取固定积分，不足 1000 字按 1000 字计算。"
    }
  ];
}

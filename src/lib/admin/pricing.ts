import {
  GENERATION_TASK_QUOTA_COST,
  HUMANIZE_TASK_QUOTA_COST
} from "@/src/lib/billing/quote-task-cost";

export type AdminPricingRule = {
  id: "generation" | "humanize";
  title: string;
  quotaCost: number;
  description: string;
  note: string;
};

export function getAdminPricingRules(): AdminPricingRule[] {
  return [
    {
      id: "generation",
      title: "生成文章",
      quotaCost: GENERATION_TASK_QUOTA_COST,
      description: "用户每次点击开始写作，系统会先冻结这一笔积分，任务真正创建成功后再正式扣掉。",
      note: "当前固定规则：每次生成文章都扣同样的积分，不会因为字数临时乱跳。"
    },
    {
      id: "humanize",
      title: "自动降AI",
      quotaCost: HUMANIZE_TASK_QUOTA_COST,
      description: "用户以后点击自动降AI时，会单独扣这一笔积分，不会和文章生成混在一起。",
      note: "这一步现在先保留固定扣点说明，等 StealthGPT 真接上后再开放后台修改。"
    }
  ];
}

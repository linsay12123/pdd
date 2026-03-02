export type RechargePackage = {
  id: string;
  title: string;
  quotaAmount: number;
  amountUsd: number;
  description: string;
};

export const supportedCryptoAssets = ["USDC", "USDT"] as const;
export const supportedCryptoNetworks = ["base", "ethereum", "solana"] as const;

export type SupportedCryptoAsset = (typeof supportedCryptoAssets)[number];
export type SupportedCryptoNetwork = (typeof supportedCryptoNetworks)[number];

export type SubscriptionPackage = {
  id: string;
  title: string;
  monthlyQuota: number;
  amountUsd: number;
  description: string;
};

export const rechargePackages: RechargePackage[] = [
  {
    id: "recharge-starter",
    title: "入门包",
    quotaAmount: 20,
    amountUsd: 19,
    description: "适合偶尔生成文章，先小额试用。"
  },
  {
    id: "recharge-growth",
    title: "进阶包",
    quotaAmount: 60,
    amountUsd: 49,
    description: "适合稳定接单，单次成本更低。"
  },
  {
    id: "recharge-scale",
    title: "批量包",
    quotaAmount: 140,
    amountUsd: 99,
    description: "适合长期批量使用，优先保证额度充足。"
  }
];

export const subscriptionPackages: SubscriptionPackage[] = [
  {
    id: "sub-monthly-starter",
    title: "月订阅基础版",
    monthlyQuota: 80,
    amountUsd: 59,
    description: "每月自动发放额度，不滚存。"
  },
  {
    id: "sub-monthly-pro",
    title: "月订阅专业版",
    monthlyQuota: 200,
    amountUsd: 129,
    description: "适合高频使用，月底自动清零再重发。"
  }
];

export function getRechargePackageById(packageId: string) {
  return rechargePackages.find((pkg) => pkg.id === packageId) ?? null;
}

export type ActivationCodeTier = 1000 | 5000 | 10000 | 20000;
export type ActivationCodeStatus = "unused" | "used";

export type ActivationCodeListQuery = {
  status?: ActivationCodeStatus;
  keyword?: string;
};

export type ActivationCodeRecord = {
  code: string;
  tier: ActivationCodeTier;
  quotaAmount: number;
  createdAt: string;
  usedAt: string | null;
  usedByUserId: string | null;
  usedByEmail: string | null;
  usedByDisplayName: string | null;
};

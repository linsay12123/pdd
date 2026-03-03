import { randomBytes } from "node:crypto";
import type {
  ActivationCodeListQuery,
  ActivationCodeRecord,
  ActivationCodeTier
} from "@/src/types/activation-codes";

const activationCodeStore = new Map<string, ActivationCodeRecord>();
const allowedTiers = new Set<ActivationCodeTier>([1000, 5000, 10000, 20000]);

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

function buildActivationCode(tier: ActivationCodeTier) {
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return normalizeCode(`PDD-${tier}-${suffix}`);
}

export function resetActivationCodeState() {
  activationCodeStore.clear();
}

export function createActivationCodes(input: {
  tier: ActivationCodeTier;
  count: number;
}) {
  if (!allowedTiers.has(input.tier)) {
    throw new Error("不支持这个激活码档位");
  }

  if (input.count <= 0) {
    throw new Error("生成数量必须大于 0");
  }

  if (input.count > 50) {
    throw new Error("最多一次生成 50 个");
  }

  const createdCodes: ActivationCodeRecord[] = [];

  while (createdCodes.length < input.count) {
    const code = buildActivationCode(input.tier);

    if (activationCodeStore.has(code)) {
      continue;
    }

    const record: ActivationCodeRecord = {
      code,
      tier: input.tier,
      quotaAmount: input.tier,
      createdAt: new Date().toISOString(),
      usedAt: null,
      usedByUserId: null,
      usedByEmail: null,
      usedByDisplayName: null
    };

    activationCodeStore.set(code, record);
    createdCodes.push(record);
  }

  return createdCodes;
}

export function listActivationCodes(query: ActivationCodeListQuery = {}) {
  const normalizedKeyword = query.keyword?.trim().toUpperCase() ?? "";

  return Array.from(activationCodeStore.values()).filter((record) => {
    if (query.status === "used" && !record.usedByUserId) {
      return false;
    }

    if (query.status === "unused" && record.usedByUserId) {
      return false;
    }

    if (normalizedKeyword && !record.code.includes(normalizedKeyword)) {
      return false;
    }

    return true;
  });
}

export function redeemStoredActivationCode(input: {
  code: string;
  userId: string;
}) {
  const normalizedCode = normalizeCode(input.code);
  const record = activationCodeStore.get(normalizedCode);

  if (!record) {
    throw new Error("激活码不存在");
  }

  if (record.usedByUserId) {
    throw new Error("激活码已经被使用");
  }

  const redeemedRecord: ActivationCodeRecord = {
    ...record,
    usedAt: new Date().toISOString(),
    usedByUserId: input.userId,
    usedByEmail: null,
    usedByDisplayName: null
  };

  activationCodeStore.set(normalizedCode, redeemedRecord);
  return redeemedRecord;
}

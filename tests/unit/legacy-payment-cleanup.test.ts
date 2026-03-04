import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(__dirname, "../..");

const removedPaths = [
  "app/api/payments/alipay/create-order/route.ts",
  "app/api/payments/alipay/notify/route.ts",
  "app/api/payments/wechat/create-order/route.ts",
  "app/api/payments/wechat/notify/route.ts",
  "app/api/payments/stripe/create-checkout/route.ts",
  "app/api/payments/stripe/webhook/route.ts",
  "app/api/payments/crypto/create-order/route.ts",
  "app/api/admin/repair/route.ts",
  "app/api/admin/fix-frozen-credits/route.ts",
  "src/lib/payments/catalog.ts",
  "src/lib/subscriptions/grant-monthly-quota.ts",
  "src/lib/subscriptions/sync-stripe-subscription.ts",
  "trigger/jobs/grant-subscription-quota.ts"
];

describe("legacy payment cleanup", () => {
  it("removes old online payment and subscription code from the production codebase", () => {
    for (const relativePath of removedPaths) {
      expect(existsSync(resolve(projectRoot, relativePath))).toBe(false);
    }
  });
});

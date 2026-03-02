import { grantMonthlyQuota } from "@/src/lib/subscriptions/grant-monthly-quota";

export async function grantSubscriptionQuota({
  asOf
}: {
  asOf?: string;
} = {}) {
  return grantMonthlyQuota({
    asOf
  });
}

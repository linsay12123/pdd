import { createLedgerEntry } from "@/src/lib/billing/ledger";
import { getSubscriptionPackageById } from "@/src/lib/payments/catalog";
import {
  appendPaymentLedgerEntry,
  getUserWallet,
  seedUserWallet
} from "@/src/lib/payments/repository";
import { listSubscriptions } from "@/src/lib/subscriptions/sync-stripe-subscription";

const grantedSubscriptionMonths = new Set<string>();

export function grantMonthlyQuota({
  asOf = new Date().toISOString()
}: {
  asOf?: string;
}) {
  const monthKey = asOf.slice(0, 7);
  const grantedSubscriptions: string[] = [];

  for (const subscription of listSubscriptions()) {
    if (subscription.status !== "active") {
      continue;
    }

    const grantKey = `subscription:${subscription.stripeSubscriptionId}:${monthKey}`;

    if (grantedSubscriptionMonths.has(grantKey)) {
      continue;
    }

    const plan = getSubscriptionPackageById(subscription.planId);

    if (!plan) {
      continue;
    }

    const wallet = getUserWallet(subscription.userId);
    const nextWallet = {
      ...wallet,
      subscriptionQuota: plan.monthlyQuota
    };

    seedUserWallet(subscription.userId, nextWallet);
    appendPaymentLedgerEntry(
      subscription.userId,
      createLedgerEntry({
        kind: "subscription_credit",
        amount: plan.monthlyQuota,
        taskId: subscription.stripeSubscriptionId,
        note: `Granted ${plan.monthlyQuota} monthly quota for ${monthKey}`
      })
    );
    grantedSubscriptionMonths.add(grantKey);
    grantedSubscriptions.push(subscription.stripeSubscriptionId);
  }

  return {
    grantedSubscriptions
  };
}

export function getGrantedSubscriptionMonths() {
  return [...grantedSubscriptionMonths];
}

export function resetGrantedSubscriptionMonths() {
  grantedSubscriptionMonths.clear();
}

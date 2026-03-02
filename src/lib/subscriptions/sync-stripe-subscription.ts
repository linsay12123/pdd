export type LocalSubscriptionRecord = {
  userId: string;
  stripeSubscriptionId: string;
  planId: string;
  status: string;
  currentPeriodEnd: string;
};

const subscriptionStore = new Map<string, LocalSubscriptionRecord>();

export function syncStripeSubscription(
  input: LocalSubscriptionRecord
) {
  subscriptionStore.set(input.stripeSubscriptionId, input);
  return input;
}

export function getSubscriptionByStripeId(stripeSubscriptionId: string) {
  return subscriptionStore.get(stripeSubscriptionId) ?? null;
}

export function listSubscriptions() {
  return [...subscriptionStore.values()];
}

export function resetSubscriptionStore() {
  subscriptionStore.clear();
}

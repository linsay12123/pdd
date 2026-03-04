import { createLedgerEntry } from "@/src/lib/billing/ledger";
import type {
  StoredQuotaLedgerEntry,
  WalletSnapshot
} from "@/src/types/billing";

const walletStore = new Map<string, WalletSnapshot>();
const paymentLedgerStore = new Map<string, StoredQuotaLedgerEntry[]>();

export function resetPaymentState() {
  walletStore.clear();
  paymentLedgerStore.clear();
}

export function seedUserWallet(userId: string, wallet: WalletSnapshot) {
  return setUserWallet(userId, wallet);
}

export function setUserWallet(userId: string, wallet: WalletSnapshot) {
  walletStore.set(userId, wallet);
  return wallet;
}

export function getUserWallet(userId: string) {
  return (
    walletStore.get(userId) ?? {
      rechargeQuota: 0,
      subscriptionQuota: 0,
      frozenQuota: 0
    }
  );
}

export function getPaymentLedgerEntries(userId: string) {
  return [...(paymentLedgerStore.get(userId) ?? [])].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
}

export function appendPaymentLedgerEntry(
  userId: string,
  entry: ReturnType<typeof createLedgerEntry>,
  createdAt = new Date().toISOString()
) {
  const storedEntry: StoredQuotaLedgerEntry = {
    ...entry,
    createdAt
  };

  paymentLedgerStore.set(userId, [
    ...(paymentLedgerStore.get(userId) ?? []),
    storedEntry
  ]);

  return storedEntry;
}

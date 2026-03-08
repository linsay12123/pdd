import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { createSupabaseAdminClientMock } = vi.hoisted(() => ({
  createSupabaseAdminClientMock: vi.fn()
}));

vi.mock("../../src/lib/supabase/admin", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock
}));

import { applyWalletMutationWithLedgerInSupabase } from "../../src/lib/payments/supabase-wallet";

describe("supabase wallet mutation", () => {
  beforeEach(() => {
    createSupabaseAdminClientMock.mockReset();
  });

  it("falls back to direct wallet + ledger writes when the RPC still hits the ambiguous recharge_quota bug", async () => {
    const quotaWalletUpdateChain = {
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          recharge_quota: 4310,
          subscription_quota: 0,
          frozen_quota: 690
        },
        error: null
      })
    };
    const quotaLedgerInsertChain = {
      insert: vi.fn().mockResolvedValue({ error: null })
    };
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: {
          message: 'column reference "recharge_quota" is ambiguous'
        }
      }),
      from: vi.fn((table: string) => {
        if (table === "quota_wallets") {
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
            update: vi.fn().mockReturnValue(quotaWalletUpdateChain)
          };
        }

        if (table === "quota_ledger_entries") {
          return quotaLedgerInsertChain;
        }

        throw new Error(`Unexpected table: ${table}`);
      })
    };
    createSupabaseAdminClientMock.mockReturnValue(client);

    const wallet = await applyWalletMutationWithLedgerInSupabase({
      userId: "user-1",
      taskId: "task-1",
      expectedWallet: {
        rechargeQuota: 5000,
        subscriptionQuota: 0,
        frozenQuota: 0
      },
      nextWallet: {
        rechargeQuota: 4310,
        subscriptionQuota: 0,
        frozenQuota: 690
      },
      entry: {
        kind: "task_freeze",
        amount: -690,
        taskId: "task-1",
        note: "freeze",
        ledgerKey: "task-freeze:task-1"
      }
    });

    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.from).toHaveBeenCalledWith("quota_wallets");
    expect(quotaWalletUpdateChain.eq).toHaveBeenNthCalledWith(1, "user_id", "user-1");
    expect(quotaWalletUpdateChain.eq).toHaveBeenNthCalledWith(2, "recharge_quota", 5000);
    expect(quotaWalletUpdateChain.eq).toHaveBeenNthCalledWith(3, "subscription_quota", 0);
    expect(quotaWalletUpdateChain.eq).toHaveBeenNthCalledWith(4, "frozen_quota", 0);
    expect(wallet).toEqual({
      rechargeQuota: 4310,
      subscriptionQuota: 0,
      frozenQuota: 690
    });
  });
});

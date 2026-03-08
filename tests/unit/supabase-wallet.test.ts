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

  it("uses the wallet rpc result directly when the database function succeeds", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            applied: true,
            conflict: false,
            recharge_quota: 4310,
            subscription_quota: 0,
            frozen_quota: 690
          }
        ],
        error: null
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
    expect(wallet).toEqual({
      rechargeQuota: 4310,
      subscriptionQuota: 0,
      frozenQuota: 690
    });
  });

  it("surfaces the raw rpc error instead of falling back to split wallet writes", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: {
          message: 'column reference "recharge_quota" is ambiguous'
        }
      }),
      from: vi.fn()
    };
    createSupabaseAdminClientMock.mockReturnValue(client);

    await expect(
      applyWalletMutationWithLedgerInSupabase({
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
      })
    ).rejects.toThrow('原子更新积分失败：column reference "recharge_quota" is ambiguous');

    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.from).not.toHaveBeenCalled();
  });
});

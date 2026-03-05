import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createSupabaseAdminClientMock,
  getUserWalletFromSupabaseMock,
  applyWalletMutationWithLedgerInSupabaseMock
} = vi.hoisted(() => ({
  createSupabaseAdminClientMock: vi.fn(),
  getUserWalletFromSupabaseMock: vi.fn(),
  applyWalletMutationWithLedgerInSupabaseMock: vi.fn()
}));

vi.mock("../../src/lib/supabase/admin", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock
}));

vi.mock("../../src/lib/payments/supabase-wallet", () => ({
  getUserWalletFromSupabase: getUserWalletFromSupabaseMock,
  applyWalletMutationWithLedgerInSupabase: applyWalletMutationWithLedgerInSupabaseMock
}));

import { cleanupStaleQuotaReservations } from "../../src/lib/billing/cleanup-stale-reservations";

function buildClientWithRows(rows: unknown[]) {
  const updatePatches: Array<Record<string, unknown>> = [];

  const client = {
    from(table: string) {
      if (table !== "writing_tasks") {
        throw new Error("unexpected table");
      }

      return {
        select() {
          return {
            not() {
              return {
                limit: async () => ({
                  data: rows,
                  error: null
                })
              };
            }
          };
        },
        update(patch: Record<string, unknown>) {
          updatePatches.push(patch);
          return {
            eq() {
              return {
                eq() {
                  return {
                    in: async () => ({
                      error: null
                    })
                  };
                }
              };
            }
          };
        }
      };
    }
  };

  return { client, updatePatches };
}

describe("cleanup stale reservations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserWalletFromSupabaseMock.mockResolvedValue({
      rechargeQuota: 500,
      subscriptionQuota: 0,
      frozenQuota: 700
    });
    applyWalletMutationWithLedgerInSupabaseMock.mockResolvedValue(undefined);
  });

  it("releases stale generation reservation and marks task failed", async () => {
    const { client, updatePatches } = buildClientWithRows([
      {
        id: "task-1",
        user_id: "user-1",
        status: "drafting",
        quota_reservation: {
          reservationId: "res-1",
          taskId: "task-1",
          chargePath: "generation",
          totalAmount: 700,
          fromSubscription: 0,
          fromRecharge: 700
        },
        updated_at: "2026-03-05T00:00:00.000Z",
        humanize_status: "idle",
        humanize_requested_at: null
      }
    ]);
    createSupabaseAdminClientMock.mockReturnValue(client);

    const result = await cleanupStaleQuotaReservations({
      now: new Date("2026-03-05T01:00:00.000Z"),
      generationTimeoutSeconds: 60,
      humanizeTimeoutSeconds: 60
    });

    expect(result.released).toBe(1);
    expect(applyWalletMutationWithLedgerInSupabaseMock).toHaveBeenCalledTimes(1);
    expect(updatePatches[0]).toMatchObject({
      quota_reservation: null,
      status: "failed"
    });
  });

  it("skips non-stale reservations", async () => {
    const { client, updatePatches } = buildClientWithRows([
      {
        id: "task-2",
        user_id: "user-2",
        status: "drafting",
        quota_reservation: {
          reservationId: "res-2",
          taskId: "task-2",
          chargePath: "generation",
          totalAmount: 100,
          fromSubscription: 0,
          fromRecharge: 100
        },
        updated_at: "2026-03-05T00:59:40.000Z",
        humanize_status: "idle",
        humanize_requested_at: null
      }
    ]);
    createSupabaseAdminClientMock.mockReturnValue(client);

    const result = await cleanupStaleQuotaReservations({
      now: new Date("2026-03-05T01:00:00.000Z"),
      generationTimeoutSeconds: 60
    });

    expect(result.released).toBe(0);
    expect(result.skipped).toBe(1);
    expect(applyWalletMutationWithLedgerInSupabaseMock).not.toHaveBeenCalled();
    expect(updatePatches).toHaveLength(0);
  });
});

import { describe, expect, it, vi } from "vitest";
import { ensureSessionUserBootstrap } from "../../src/lib/auth/session-bootstrap";

describe("session bootstrap safety", () => {
  it("uses insert-only semantics for profiles and wallets", async () => {
    const profileUpsert = vi.fn().mockResolvedValue({ error: null });
    const walletUpsert = vi.fn().mockResolvedValue({ error: null });

    await ensureSessionUserBootstrap(
      {
        authUserId: "user-1",
        email: "user@example.com"
      },
      {
        createAdminClient: () =>
          ({
            from: (table: string) => {
              if (table === "profiles") {
                return {
                  upsert: profileUpsert
                };
              }

              if (table === "quota_wallets") {
                return {
                  upsert: walletUpsert
                };
              }

              throw new Error(`unexpected table: ${table}`);
            }
          }) as never
      }
    );

    expect(profileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "user-1",
        role: "user",
        is_frozen: false
      }),
      expect.objectContaining({
        onConflict: "id",
        ignoreDuplicates: true
      })
    );

    expect(walletUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        recharge_quota: 0,
        subscription_quota: 0,
        frozen_quota: 0
      }),
      expect.objectContaining({
        onConflict: "user_id",
        ignoreDuplicates: true
      })
    );
  });
});

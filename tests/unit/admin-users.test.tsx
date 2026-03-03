import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const fromMock = vi.fn();

vi.mock("../../src/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: fromMock
  })
}));

describe("admin users", () => {
  it("loads real users and merges their wallet balances", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            order: async () => ({
              data: [
                {
                  id: "user-1",
                  email: "real-user@example.com",
                  display_name: "真实用户",
                  role: "user",
                  is_frozen: false,
                  created_at: "2026-03-03T10:00:00.000Z"
                }
              ],
              error: null
            })
          })
        };
      }

      if (table === "quota_wallets") {
        return {
          select: async () => ({
            data: [
              {
                user_id: "user-1",
                recharge_quota: 5000,
                subscription_quota: 1000,
                frozen_quota: 500
              }
            ],
            error: null
          })
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const { listAdminUsers } = await import("../../src/lib/admin/users");
    const users = await listAdminUsers({
      shouldUseSupabase: () => true
    });

    expect(users).toEqual([
      expect.objectContaining({
        email: "real-user@example.com",
        displayName: "真实用户",
        currentQuota: 6000,
        rechargeQuota: 5000,
        subscriptionQuota: 1000,
        frozenQuota: 500,
        status: "active"
      })
    ]);
  });

  it("renders homepage-style user cards with real balances", async () => {
    const { UserTableView } = await import("../../src/components/admin/user-table");
    const html = renderToStaticMarkup(
      <UserTableView
        users={[
          {
            id: "user-2",
            email: "owner@example.com",
            displayName: "演示用户",
            role: "admin",
            status: "frozen",
            currentQuota: 8800,
            rechargeQuota: 8000,
            subscriptionQuota: 800,
            frozenQuota: 500,
            createdAt: "2026-03-03T09:00:00.000Z"
          }
        ]}
      />
    );

    expect(html).toContain("用户管理");
    expect(html).toContain("演示用户");
    expect(html).toContain("8,800");
    expect(html).toContain("管理员");
    expect(html).not.toContain("client-a@example.com");
  });
});

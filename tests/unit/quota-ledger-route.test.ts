import { describe, expect, it } from "vitest";
import { handleQuotaLedgerRequest } from "../../app/api/quota/ledger/route";

describe("quota ledger route", () => {
  it("returns 401 when user context is missing", async () => {
    const response = await handleQuotaLedgerRequest(
      new Request("http://localhost/api/quota/ledger", {
        method: "GET"
      }),
      {
        requireUser: async () => {
          throw new Error("AUTH_REQUIRED");
        }
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.message).toContain("登录");
  });

  it("returns mapped ledger entries from the real database path", async () => {
    const response = await handleQuotaLedgerRequest(
      new Request("http://localhost/api/quota/ledger", {
        method: "GET"
      }),
      {
        requireUser: async () => ({
          id: "11111111-1111-4111-8111-111111111111",
          email: "ledger@example.com",
          role: "user"
        }),
        shouldUseSupabase: () => true,
        getSupabaseLedger: async () => [
          {
            id: "entry-1",
            kind: "task_settle",
            title: "生成文章",
            detail: "扣除 500 积分",
            amount: -500,
            balanceAfter: 4500,
            createdAt: "2026-03-03T09:00:00.000Z"
          },
          {
            id: "entry-2",
            kind: "activation_credit",
            title: "激活码兑换",
            detail: "充值 5000 积分",
            amount: 5000,
            balanceAfter: 5000,
            createdAt: "2026-03-03T08:30:00.000Z"
          }
        ]
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.entries).toHaveLength(2);
    expect(payload.entries[0]).toMatchObject({
      title: "生成文章",
      amount: -500
    });
    expect(payload.entries[1]).toMatchObject({
      title: "激活码兑换",
      amount: 5000
    });
  });

  it("returns 503 instead of silently reading fake local ledger data when the real database is unavailable", async () => {
    const response = await handleQuotaLedgerRequest(
      new Request("http://localhost/api/quota/ledger", {
        method: "GET"
      }),
      {
        requireUser: async () => ({
          id: "11111111-1111-4111-8111-111111111111",
          email: "ledger@example.com",
          role: "user"
        }),
        shouldUseSupabase: () => false
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.message).toContain("正式积分数据库");
  });
});

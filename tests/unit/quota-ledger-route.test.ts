import { beforeEach, describe, expect, it } from "vitest";
import { createLedgerEntry } from "../../src/lib/billing/ledger";
import {
  appendPaymentLedgerEntry,
  resetPaymentState
} from "../../src/lib/payments/repository";
import { handleQuotaLedgerRequest } from "../../app/api/quota/ledger/route";

describe("quota ledger route", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    resetPaymentState();
  });

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

  it("returns mapped ledger entries for the current user", async () => {
    appendPaymentLedgerEntry(
      "user-ledger-1",
      createLedgerEntry({
        kind: "activation_credit",
        amount: 5000,
        taskId: "PDD-5000-TEST",
        note: "Redeemed activation code"
      }),
      "2026-03-03T08:30:00.000Z"
    );

    appendPaymentLedgerEntry(
      "user-ledger-1",
      createLedgerEntry({
        kind: "task_freeze",
        amount: 500,
        taskId: "task-1",
        note: "Froze 500 quota for generation"
      }),
      "2026-03-03T09:00:00.000Z"
    );

    const response = await handleQuotaLedgerRequest(
      new Request("http://localhost/api/quota/ledger", {
        method: "GET"
      }),
      {
        requireUser: async () => ({
          id: "user-ledger-1",
          email: "ledger@example.com",
          role: "user"
        })
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
});

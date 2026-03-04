import { beforeEach, describe, expect, it } from "vitest";
import { handleTaskCreateRequest } from "../../app/api/tasks/create/route";
import {
  getTaskSummary,
  resetTaskStore
} from "../../src/lib/tasks/repository";
import {
  resetPaymentState,
  seedUserWallet,
  getUserWallet
} from "../../src/lib/payments/repository";

describe("task create route", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    resetPaymentState();
    resetTaskStore();
  });

  it("rejects unauthenticated users", async () => {
    const response = await handleTaskCreateRequest(
      new Request("http://localhost/api/tasks/create", {
        method: "POST",
        body: JSON.stringify({
          specialRequirements: "Focus on finance."
        }),
        headers: {
          "content-type": "application/json"
        }
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

  it("rejects users with insufficient quota", async () => {
    seedUserWallet("user-low", {
      rechargeQuota: 300,
      subscriptionQuota: 0,
      frozenQuota: 0
    });

    const response = await handleTaskCreateRequest(
      new Request("http://localhost/api/tasks/create", {
        method: "POST",
        body: JSON.stringify({
          specialRequirements: "Focus on finance."
        }),
        headers: {
          "content-type": "application/json"
        }
      }),
      {
        requireUser: async () => ({
          id: "user-low",
          email: "low@example.com",
          role: "user"
        })
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.message).toContain("积分不足");
  });

  it("checks balance and creates task without freezing quota", async () => {
    seedUserWallet("user-ok", {
      rechargeQuota: 1000,
      subscriptionQuota: 0,
      frozenQuota: 0
    });

    const response = await handleTaskCreateRequest(
      new Request("http://localhost/api/tasks/create", {
        method: "POST",
        body: JSON.stringify({
          specialRequirements: "Focus on ASEAN banking examples.",
          targetWordCount: 2200,
          citationStyle: "MLA"
        }),
        headers: {
          "content-type": "application/json"
        }
      }),
      {
        requireUser: async () => ({
          id: "user-ok",
          email: "ok@example.com",
          role: "user"
        })
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.task.status).toBe("created");
    expect(payload.task.targetWordCount).toBeNull();
    expect(payload.task.citationStyle).toBeNull();
    expect(payload.task.specialRequirements).toContain("ASEAN banking");
    expect(payload.frozenQuota).toBe(0);

    const storedTask = getTaskSummary(payload.task.id);
    expect(storedTask).toMatchObject({
      id: payload.task.id,
      userId: "user-ok",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: "Focus on ASEAN banking examples."
    });

    // Wallet should remain unchanged — quota is only frozen at outline approval
    expect(getUserWallet("user-ok")).toEqual({
      rechargeQuota: 1000,
      subscriptionQuota: 0,
      frozenQuota: 0
    });
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { handleCancelRequest } from "../../app/api/tasks/[taskId]/cancel/route";
import {
  getTaskSummary,
  resetTaskStore,
  saveTaskSummary
} from "../../src/lib/tasks/repository";
import {
  getUserWallet,
  resetPaymentState,
  seedUserWallet
} from "../../src/lib/payments/repository";
import type { FrozenQuotaReservation } from "../../src/types/billing";

function makeRequest() {
  return new Request("http://localhost/api/tasks/task-1/cancel", {
    method: "POST"
  });
}

function makeContext(taskId: string) {
  return { params: Promise.resolve({ taskId }) };
}

const testReservation: FrozenQuotaReservation = {
  taskId: "task-1",
  chargePath: "generation",
  totalAmount: 460,
  fromSubscription: 0,
  fromRecharge: 460
};

describe("task cancel route", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    resetPaymentState();
    resetTaskStore();
  });

  it("rejects unauthenticated users with 401", async () => {
    const response = await handleCancelRequest(
      makeRequest(),
      makeContext("task-1"),
      {
        requireUser: async () => {
          throw new Error("AUTH_REQUIRED");
        }
      }
    );

    expect(response.status).toBe(401);
    const payload = await response.json();
    expect(payload.ok).toBe(false);
    expect(payload.message).toContain("登录");
  });

  it("rejects tasks in non-cancellable status with 400", async () => {
    saveTaskSummary({
      id: "task-1",
      userId: "user-1",
      status: "drafting",
      targetWordCount: 2000,
      citationStyle: "APA 7",
      quotaReservation: testReservation
    });

    const response = await handleCancelRequest(
      makeRequest(),
      makeContext("task-1"),
      {
        requireUser: async () => ({
          id: "user-1",
          email: "user@example.com",
          role: "user"
        })
      }
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.ok).toBe(false);
    expect(payload.message).toContain("不允许取消");
  });

  it("cancels pre-approval task without releasing quota", async () => {
    saveTaskSummary({
      id: "task-1",
      userId: "user-1",
      status: "created",
      targetWordCount: 2000,
      citationStyle: "APA 7"
    });

    seedUserWallet("user-1", {
      rechargeQuota: 1000,
      subscriptionQuota: 0,
      frozenQuota: 0
    });

    const response = await handleCancelRequest(
      makeRequest(),
      makeContext("task-1"),
      {
        requireUser: async () => ({
          id: "user-1",
          email: "user@example.com",
          role: "user"
        })
      }
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.releasedQuota).toBe(0);

    const task = getTaskSummary("task-1");
    expect(task?.status).toBe("failed");

    // Wallet unchanged — no quota was frozen
    const wallet = getUserWallet("user-1");
    expect(wallet).toEqual({
      rechargeQuota: 1000,
      subscriptionQuota: 0,
      frozenQuota: 0
    });
  });

  it("releases quota and marks task as failed when quota was frozen", async () => {
    saveTaskSummary({
      id: "task-1",
      userId: "user-1",
      status: "quota_frozen",
      targetWordCount: 2000,
      citationStyle: "APA 7",
      quotaReservation: testReservation
    });

    seedUserWallet("user-1", {
      rechargeQuota: 540,
      subscriptionQuota: 0,
      frozenQuota: 460
    });

    const response = await handleCancelRequest(
      makeRequest(),
      makeContext("task-1"),
      {
        requireUser: async () => ({
          id: "user-1",
          email: "user@example.com",
          role: "user"
        })
      }
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.releasedQuota).toBe(460);

    const task = getTaskSummary("task-1");
    expect(task?.status).toBe("failed");

    const wallet = getUserWallet("user-1");
    expect(wallet).toEqual({
      rechargeQuota: 1000,
      subscriptionQuota: 0,
      frozenQuota: 0
    });
  });

  it("allows cancelling awaiting_outline_approval tasks", async () => {
    saveTaskSummary({
      id: "task-1",
      userId: "user-1",
      status: "awaiting_outline_approval",
      targetWordCount: 2000,
      citationStyle: "APA 7"
    });

    seedUserWallet("user-1", {
      rechargeQuota: 1000,
      subscriptionQuota: 0,
      frozenQuota: 0
    });

    const response = await handleCancelRequest(
      makeRequest(),
      makeContext("task-1"),
      {
        requireUser: async () => ({
          id: "user-1",
          email: "user@example.com",
          role: "user"
        })
      }
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.releasedQuota).toBe(0);
  });
});

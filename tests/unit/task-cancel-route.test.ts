import { beforeEach, describe, expect, it } from "vitest";
import { handleCancelRequest } from "../../app/api/tasks/[taskId]/cancel/route";
import {
  getTaskSummary,
  patchTaskSummary,
  resetTaskStore,
  saveTaskSummary
} from "../../src/lib/tasks/repository";
import {
  appendPaymentLedgerEntry,
  getUserWallet,
  resetPaymentState,
  seedUserWallet,
  setUserWallet
} from "../../src/lib/payments/repository";
import { releaseQuota } from "../../src/lib/billing/release-quota";
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
  reservationId: "resv-cancel-task-1",
  taskId: "task-1",
  chargePath: "generation",
  totalAmount: 460,
  fromSubscription: 0,
  fromRecharge: 460
};

function makeRouteDeps(taskId: string, userId = "user-1") {
  return {
    requireUser: async () => ({
      id: userId,
      email: "user@example.com",
      role: "user" as const
    }),
    isPersistenceReady: () => true,
    loadTask: async () => {
      const task = getTaskSummary(taskId);

      return task
        ? {
            taskId,
            userId,
            status: task.status,
            quotaReservation: task.quotaReservation ?? null
          }
        : null;
    },
    releaseQuotaReservation: async (_taskId: string, releaseUserId: string, reservation: FrozenQuotaReservation) => {
      const wallet = getUserWallet(releaseUserId);
      const released = releaseQuota({ wallet, reservation });
      setUserWallet(releaseUserId, released.wallet);
      appendPaymentLedgerEntry(releaseUserId, released.entry);
    },
    markTaskFailed: async () => {
      patchTaskSummary(taskId, {
        status: "failed",
        quotaReservation: undefined
      });
    }
  };
}

describe("task cancel route", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    resetPaymentState();
    resetTaskStore();
  });

  it("does not silently fall back to the local task store when the real database pipeline is unavailable", async () => {
    saveTaskSummary({
      id: "task-1",
      userId: "user-1",
      status: "awaiting_outline_approval",
      targetWordCount: 2000,
      citationStyle: "APA 7"
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
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.ok).toBe(false);
    expect(payload.message).toContain("真实数据库");
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
        ...makeRouteDeps("task-1")
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
        ...makeRouteDeps("task-1")
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

  it("releases quota and marks task as failed when an old reservation is still hanging on the pre-writing step", async () => {
    saveTaskSummary({
      id: "task-1",
      userId: "user-1",
      status: "awaiting_outline_approval",
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
        ...makeRouteDeps("task-1")
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
        ...makeRouteDeps("task-1")
      }
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.releasedQuota).toBe(0);
  });
});

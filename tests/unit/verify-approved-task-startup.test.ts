import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { verifyApprovedTaskStartup } from "../../src/lib/tasks/verify-approved-task-startup";
import {
  WORKFLOW_STARTUP_PENDING_VERSION_MESSAGE,
  WORKFLOW_STARTUP_STALLED_MESSAGE
} from "../../src/lib/tasks/workflow-runtime-errors";

describe("verify approved task startup", () => {
  it("fails quickly when trigger reports pending_version", async () => {
    const finalizeFailure = vi.fn().mockResolvedValue(undefined);
    const resolveRunState = vi.fn().mockResolvedValue({
      state: "pending_version",
      status: "PENDING_VERSION"
    });

    const result = await verifyApprovedTaskStartup(
      {
        taskId: "task-1",
        userId: "user-1",
        approvalAttemptCount: 2,
        triggerRunId: "run-1"
      },
      {
        finalizeFailure,
        resolveRunState,
        sleep: async () => undefined
      }
    );

    expect(result).toEqual({
      ok: false,
      state: "pending_version",
      status: "PENDING_VERSION",
      message: WORKFLOW_STARTUP_PENDING_VERSION_MESSAGE
    });
    expect(finalizeFailure).toHaveBeenCalledWith({
      taskId: "task-1",
      userId: "user-1",
      expectedApprovalAttemptCount: 2,
      mode: "fail",
      failureMessage: WORKFLOW_STARTUP_PENDING_VERSION_MESSAGE
    });
  });

  it("accepts active runs without marking the task failed", async () => {
    const finalizeFailure = vi.fn().mockResolvedValue(undefined);
    const resolveRunState = vi.fn().mockResolvedValue({
      state: "active",
      status: "RUNNING"
    });

    const result = await verifyApprovedTaskStartup(
      {
        taskId: "task-1",
        userId: "user-1",
        approvalAttemptCount: 3,
        triggerRunId: "run-2"
      },
      {
        finalizeFailure,
        resolveRunState,
        sleep: async () => undefined
      }
    );

    expect(result).toEqual({
      ok: true,
      state: "active",
      status: "RUNNING",
      message: "后台正文任务已经真正启动。"
    });
    expect(finalizeFailure).not.toHaveBeenCalled();
  });

  it("waits up to the startup window before failing unknown runs", async () => {
    const finalizeFailure = vi.fn().mockResolvedValue(undefined);
    const resolveRunState = vi.fn().mockResolvedValue({
      state: "unknown",
      status: null
    });

    const nowValues = [0, 0, 2_000, 4_000, 6_000, 8_000, 10_000, 12_000, 14_000, 16_000, 18_000, 20_000, 22_000, 24_000, 26_000, 28_000, 30_000, 32_000];
    const dateNowSpy = vi.spyOn(Date, "now").mockImplementation(() => nowValues.shift() ?? 32_000);

    const result = await verifyApprovedTaskStartup(
      {
        taskId: "task-2",
        userId: "user-2",
        approvalAttemptCount: 1,
        triggerRunId: "run-3"
      },
      {
        finalizeFailure,
        resolveRunState,
        sleep: async () => undefined
      }
    );

    expect(result).toEqual({
      ok: false,
      state: "unknown",
      status: null,
      message: WORKFLOW_STARTUP_STALLED_MESSAGE
    });
    expect(resolveRunState).toHaveBeenCalledTimes(16);
    expect(finalizeFailure).toHaveBeenCalledWith({
      taskId: "task-2",
      userId: "user-2",
      expectedApprovalAttemptCount: 1,
      mode: "fail",
      failureMessage: WORKFLOW_STARTUP_STALLED_MESSAGE
    });

    dateNowSpy.mockRestore();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { handleTaskAnalysisRetryRequest } from "../../app/api/tasks/[taskId]/analysis/retry/route";
import {
  getTaskSummary,
  resetTaskFileStore,
  resetTaskStore,
  saveTaskFileRecords,
  saveTaskSummary
} from "../../src/lib/tasks/repository";

function makeUser() {
  return {
    id: "user-1",
    email: "user-1@example.com",
    role: "user" as const
  };
}

describe("analysis retry route", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    process.env.TRIGGER_SECRET_KEY = "trigger-secret";
    resetTaskStore();
    resetTaskFileStore();
  });

  it("accepts retry when pending analysis has timed out", async () => {
    saveTaskSummary({
      id: "task-timeout",
      userId: "user-1",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: "",
      analysisStatus: "pending",
      analysisRequestedAt: new Date(Date.now() - 11 * 60 * 1000).toISOString()
    });

    saveTaskFileRecords([
      {
        id: "file-1",
        taskId: "task-timeout",
        userId: "user-1",
        originalFilename: "brief.txt",
        storagePath: "tmp/brief.txt",
        extractedText: "brief",
        role: "unknown",
        isPrimary: false
      }
    ]);

    const enqueueTaskAnalysis = vi.fn(async () => "run-1");
    const response = await handleTaskAnalysisRetryRequest(
      new Request("http://localhost/api/tasks/task-timeout/analysis/retry", {
        method: "POST"
      }),
      { taskId: "task-timeout" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        enqueueTaskAnalysis
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload.analysisStatus).toBe("pending");
    expect(payload.analysisProgress.canRetry).toBe(false);
    expect(enqueueTaskAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "task-timeout",
        userId: "user-1",
        forcedPrimaryFileId: null
      })
    );
    expect(getTaskSummary("task-timeout")?.analysisStatus).toBe("pending");
  });

  it("does not enqueue another run when previous analysis run is still active", async () => {
    saveTaskSummary({
      id: "task-active-run",
      userId: "user-1",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: "",
      analysisStatus: "pending",
      analysisRequestedAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
      analysisTriggerRunId: "run-active-1"
    });

    saveTaskFileRecords([
      {
        id: "file-1",
        taskId: "task-active-run",
        userId: "user-1",
        originalFilename: "brief.txt",
        storagePath: "tmp/brief.txt",
        extractedText: "brief",
        role: "unknown",
        isPrimary: false
      }
    ]);

    const enqueueTaskAnalysis = vi.fn(async () => "run-should-not-be-used");
    const response = await handleTaskAnalysisRetryRequest(
      new Request("http://localhost/api/tasks/task-active-run/analysis/retry", {
        method: "POST"
      }),
      { taskId: "task-active-run" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        getTriggerRunState: async () => ({ state: "active", status: "EXECUTING" }),
        enqueueTaskAnalysis
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload.analysisStatus).toBe("pending");
    expect(String(payload.message)).toContain("避免重复排队");
    expect(payload.analysisProgress.canRetry).toBe(false);
    expect(enqueueTaskAnalysis).not.toHaveBeenCalled();
  });

  it("allows retry enqueue when previous run state is unknown", async () => {
    saveTaskSummary({
      id: "task-unknown-run-state",
      userId: "user-1",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: "",
      analysisStatus: "pending",
      analysisRequestedAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
      analysisTriggerRunId: "run-unknown-1"
    });

    saveTaskFileRecords([
      {
        id: "file-1",
        taskId: "task-unknown-run-state",
        userId: "user-1",
        originalFilename: "brief.txt",
        storagePath: "tmp/brief.txt",
        extractedText: "brief",
        role: "unknown",
        isPrimary: false
      }
    ]);

    const enqueueTaskAnalysis = vi.fn(async () => "run-unknown-retry-1");
    const response = await handleTaskAnalysisRetryRequest(
      new Request("http://localhost/api/tasks/task-unknown-run-state/analysis/retry", {
        method: "POST"
      }),
      { taskId: "task-unknown-run-state" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        getTriggerRunState: async () => ({ state: "unknown", status: null }),
        enqueueTaskAnalysis
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload.analysisStatus).toBe("pending");
    expect(payload.analysisRuntime.runId).toBe("run-unknown-retry-1");
    expect(String(payload.message)).toContain("已重新提交后台分析");
    expect(enqueueTaskAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "task-unknown-run-state",
        userId: "user-1"
      })
    );
  });

  it("returns 503 when previous run is pending_version and cannot be retried", async () => {
    saveTaskSummary({
      id: "task-pending-version",
      userId: "user-1",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: "",
      analysisStatus: "pending",
      analysisRequestedAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
      analysisTriggerRunId: "run-pending-version-1"
    });

    saveTaskFileRecords([
      {
        id: "file-1",
        taskId: "task-pending-version",
        userId: "user-1",
        originalFilename: "brief.txt",
        storagePath: "tmp/brief.txt",
        extractedText: "brief",
        role: "unknown",
        isPrimary: false
      }
    ]);

    const response = await handleTaskAnalysisRetryRequest(
      new Request("http://localhost/api/tasks/task-pending-version/analysis/retry", {
        method: "POST"
      }),
      { taskId: "task-pending-version" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        getTriggerRunState: async () => ({ state: "pending_version", status: "PENDING_VERSION" }),
        enqueueTaskAnalysis: async () => "run-should-not-be-used"
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(String(payload.message)).toContain("还没部署");
  });

  it("rejects retry when pending analysis has not timed out", async () => {
    saveTaskSummary({
      id: "task-pending",
      userId: "user-1",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: "",
      analysisStatus: "pending",
      analysisRequestedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString()
    });

    saveTaskFileRecords([
      {
        id: "file-1",
        taskId: "task-pending",
        userId: "user-1",
        originalFilename: "brief.txt",
        storagePath: "tmp/brief.txt",
        extractedText: "brief",
        role: "unknown",
        isPrimary: false
      }
    ]);

    const response = await handleTaskAnalysisRetryRequest(
      new Request("http://localhost/api/tasks/task-pending/analysis/retry", {
        method: "POST"
      }),
      { taskId: "task-pending" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        enqueueTaskAnalysis: async () => "run-2"
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(String(payload.message)).toContain("还在处理中");
  });

  it("accepts retry when analysis already failed", async () => {
    saveTaskSummary({
      id: "task-failed",
      userId: "user-1",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: "",
      analysisStatus: "failed"
    });

    saveTaskFileRecords([
      {
        id: "file-1",
        taskId: "task-failed",
        userId: "user-1",
        originalFilename: "brief.txt",
        storagePath: "tmp/brief.txt",
        extractedText: "brief",
        role: "unknown",
        isPrimary: false
      }
    ]);

    const response = await handleTaskAnalysisRetryRequest(
      new Request("http://localhost/api/tasks/task-failed/analysis/retry", {
        method: "POST"
      }),
      { taskId: "task-failed" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        enqueueTaskAnalysis: async () => "run-3"
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload.analysisStatus).toBe("pending");
  });

  it("returns 502 when trigger run id is missing", async () => {
    saveTaskSummary({
      id: "task-missing-run-id",
      userId: "user-1",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: "",
      analysisStatus: "failed"
    });

    saveTaskFileRecords([
      {
        id: "file-1",
        taskId: "task-missing-run-id",
        userId: "user-1",
        originalFilename: "brief.txt",
        storagePath: "tmp/brief.txt",
        extractedText: "brief",
        role: "unknown",
        isPrimary: false
      }
    ]);

    const response = await handleTaskAnalysisRetryRequest(
      new Request("http://localhost/api/tasks/task-missing-run-id/analysis/retry", {
        method: "POST"
      }),
      { taskId: "task-missing-run-id" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        enqueueTaskAnalysis: async () => null
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(String(payload.message)).toContain("后台重试任务启动失败");
  });
});

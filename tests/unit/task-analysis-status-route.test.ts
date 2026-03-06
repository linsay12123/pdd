import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { handleTaskAnalysisStatusRequest } from "../../app/api/tasks/[taskId]/analysis/route";
import {
  resetTaskFileStore,
  resetTaskOutlineStore,
  resetTaskStore,
  saveTaskFileRecords,
  saveTaskOutlineVersion,
  saveTaskSummary
} from "../../src/lib/tasks/repository";

function makeUser() {
  return {
    id: "user-1",
    email: "user-1@example.com",
    role: "user" as const
  };
}

describe("task analysis status route", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    process.env.TRIGGER_SECRET_KEY = "";
    process.env.VERCEL_ENV = "";
    resetTaskStore();
    resetTaskFileStore();
    resetTaskOutlineStore();
  });

  it("returns pending status while background analysis is still running", async () => {
    saveTaskSummary({
      id: "task-pending",
      userId: "user-1",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: "",
      analysisStatus: "pending",
      analysisRequestedAt: new Date(Date.now() - 60 * 1000).toISOString()
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

    const response = await handleTaskAnalysisStatusRequest(
      new Request("http://localhost/api/tasks/task-pending/analysis"),
      { taskId: "task-pending" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser()
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.analysisStatus).toBe("pending");
    expect(payload.outline).toBeNull();
    expect(String(payload.message)).toContain("后台分析");
    expect(payload.analysisRuntime.state).toBe("missing");
    expect(payload.analysisProgress.maxWaitSeconds).toBe(600);
    expect(payload.analysisProgress.elapsedSeconds).toBeGreaterThanOrEqual(60);
    expect(payload.analysisProgress.canRetry).toBe(false);
  });

  it("returns canRetry=true when pending analysis exceeds max wait window", async () => {
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

    const response = await handleTaskAnalysisStatusRequest(
      new Request("http://localhost/api/tasks/task-timeout/analysis"),
      { taskId: "task-timeout" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser()
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.analysisStatus).toBe("pending");
    expect(payload.analysisProgress.canRetry).toBe(true);
    expect(String(payload.message)).toContain("超时");
    expect(payload.analysisRuntime.state).toBe("missing");
  });

  it("returns succeeded payload with outline and rule card", async () => {
    saveTaskSummary({
      id: "task-succeeded",
      userId: "user-1",
      status: "awaiting_outline_approval",
      targetWordCount: 2500,
      citationStyle: "Harvard",
      specialRequirements: "Focus on ASEAN",
      latestOutlineVersionId: "outline-1",
      analysisStatus: "succeeded",
      analysisSnapshot: {
        chosenTaskFileId: "file-1",
        supportingFileIds: ["file-2"],
        ignoredFileIds: [],
        needsUserConfirmation: false,
        reasoning: "brief-defined",
        targetWordCount: 2500,
        citationStyle: "Harvard",
        topic: "ASEAN Governance Risk",
        chapterCount: 5,
        mustCover: ["Risk governance"],
        gradingFocus: ["Critical analysis"],
        appliedSpecialRequirements: "Focus on ASEAN",
        usedDefaultWordCount: false,
        usedDefaultCitationStyle: false,
        warnings: []
      }
    });

    saveTaskFileRecords([
      {
        id: "file-1",
        taskId: "task-succeeded",
        userId: "user-1",
        originalFilename: "brief.txt",
        storagePath: "tmp/brief.txt",
        extractedText: "brief",
        role: "requirement",
        isPrimary: true
      }
    ]);

    saveTaskOutlineVersion({
      id: "outline-1",
      taskId: "task-succeeded",
      userId: "user-1",
      versionNumber: 1,
      outline: {
        articleTitle: "ASEAN Governance Risk",
        targetWordCount: 2500,
        citationStyle: "Harvard",
        chineseMirrorPending: true,
        sections: [
          {
            title: "Intro",
            summary: "Scope and argument.",
            bulletPoints: ["Context", "Thesis"]
          }
        ]
      },
      feedback: "",
      isApproved: false,
      targetWordCount: 2500,
      citationStyle: "Harvard"
    });

    const response = await handleTaskAnalysisStatusRequest(
      new Request("http://localhost/api/tasks/task-succeeded/analysis"),
      { taskId: "task-succeeded" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser()
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.analysisStatus).toBe("succeeded");
    expect(payload.analysisRuntime.state).toBe("not_applicable");
    expect(payload.outline.articleTitle).toBe("ASEAN Governance Risk");
    expect(payload.ruleCard.targetWordCount).toBe(2500);
    expect(payload.classification.primaryRequirementFileId).toBe("file-1");
    expect(payload.analysisProgress.canRetry).toBe(false);
  });

  it("returns friendly failed message and no internal code", async () => {
    saveTaskSummary({
      id: "task-failed",
      userId: "user-1",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: "",
      analysisStatus: "failed",
      analysisSnapshot: {
        chosenTaskFileId: null,
        supportingFileIds: [],
        ignoredFileIds: [],
        needsUserConfirmation: false,
        reasoning: "",
        targetWordCount: 2000,
        citationStyle: "APA 7",
        topic: null,
        chapterCount: null,
        mustCover: [],
        gradingFocus: [],
        appliedSpecialRequirements: "",
        usedDefaultWordCount: true,
        usedDefaultCitationStyle: true,
        warnings: ["analysis_failed:MODEL_ANALYSIS_INCOMPLETE_AFTER_RETRY"]
      }
    });

    const response = await handleTaskAnalysisStatusRequest(
      new Request("http://localhost/api/tasks/task-failed/analysis"),
      { taskId: "task-failed" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser()
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.analysisStatus).toBe("failed");
    expect(payload.analysisRuntime.state).toBe("not_applicable");
    expect(String(payload.message)).toContain("返回内容不完整");
    expect(String(payload.message)).not.toContain("MODEL_ANALYSIS_INCOMPLETE");
    expect(payload.analysisProgress.canRetry).toBe(true);
  });

  it("returns retry-analysis message when failed snapshot has no internal code", async () => {
    saveTaskSummary({
      id: "task-failed-without-code",
      userId: "user-1",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: "",
      analysisStatus: "failed",
      analysisSnapshot: null
    });

    const response = await handleTaskAnalysisStatusRequest(
      new Request("http://localhost/api/tasks/task-failed-without-code/analysis"),
      { taskId: "task-failed-without-code" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser()
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.analysisStatus).toBe("failed");
    expect(String(payload.message)).toContain("一键重试分析");
    expect(String(payload.message)).not.toContain("重试一次上传");
  });

  it("reports pending_version clearly when trigger run is blocked by missing deployed version", async () => {
    saveTaskSummary({
      id: "task-pending-version",
      userId: "user-1",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: "",
      analysisStatus: "pending",
      analysisRequestedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      analysisTriggerRunId: "run-pending-version"
    });

    const response = await handleTaskAnalysisStatusRequest(
      new Request("http://localhost/api/tasks/task-pending-version/analysis"),
      { taskId: "task-pending-version" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        getTriggerRunState: async () => ({
          state: "pending_version",
          status: "PENDING_VERSION"
        })
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.analysisStatus).toBe("pending");
    expect(payload.analysisRuntime.state).toBe("pending_version");
    expect(String(payload.message)).toContain("重新部署");
    expect(payload.analysisProgress.canRetry).toBe(true);
  });

  it("auto-recovers immediately when an old pending_version run can be replaced by a fresh active run", async () => {
    process.env.TRIGGER_SECRET_KEY = "tr_prod_example";
    process.env.VERCEL_ENV = "production";

    saveTaskSummary({
      id: "task-pending-version-auto-recover",
      userId: "user-1",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: "",
      analysisStatus: "pending",
      analysisRequestedAt: new Date(Date.now() - 60 * 1000).toISOString(),
      analysisTriggerRunId: "run-pending-version-old"
    });

    const getTriggerRunState = vi
      .fn()
      .mockResolvedValueOnce({
        state: "pending_version",
        status: "PENDING_VERSION"
      })
      .mockResolvedValueOnce({
        state: "active",
        status: "QUEUED"
      });
    const enqueueTaskAnalysis = vi.fn(async () => "run-pending-version-recovered");

    const response = await handleTaskAnalysisStatusRequest(
      new Request("http://localhost/api/tasks/task-pending-version-auto-recover/analysis"),
      { taskId: "task-pending-version-auto-recover" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        getTriggerRunState,
        enqueueTaskAnalysis
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.analysisStatus).toBe("pending");
    expect(payload.analysisRuntime.state).toBe("active");
    expect(payload.analysisRuntime.autoRecovered).toBe(true);
    expect(payload.analysisRuntime.runId).toBe("run-pending-version-recovered");
    expect(String(payload.message)).toContain("自动补提一次分析任务");
    expect(enqueueTaskAnalysis).toHaveBeenCalledTimes(1);
    expect(getTriggerRunState).toHaveBeenCalledTimes(2);
  });

  it("auto-recovers once when run ended early but task never started", async () => {
    process.env.TRIGGER_SECRET_KEY = "tr_prod_example";
    process.env.VERCEL_ENV = "production";

    saveTaskSummary({
      id: "task-auto-recover",
      userId: "user-1",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: "",
      analysisStatus: "pending",
      analysisRequestedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      analysisTriggerRunId: "run-terminal-before-start"
    });

    const enqueueTaskAnalysis = vi.fn(async () => "run-auto-recovered");

    const response = await handleTaskAnalysisStatusRequest(
      new Request("http://localhost/api/tasks/task-auto-recover/analysis"),
      { taskId: "task-auto-recover" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        getTriggerRunState: async () => ({
          state: "terminal",
          status: "FAILED"
        }),
        enqueueTaskAnalysis
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.analysisStatus).toBe("pending");
    expect(payload.analysisRuntime.autoRecovered).toBe(true);
    expect(payload.analysisRuntime.runId).toBe("run-auto-recovered");
    expect(enqueueTaskAnalysis).toHaveBeenCalledTimes(1);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { handleTaskAnalysisStatusRequest } from "../../app/api/tasks/[taskId]/analysis/route";
import {
  resetTaskDraftStore,
  getTaskSummary,
  resetTaskOutputStore,
  resetTaskFileStore,
  resetTaskOutlineStore,
  resetTaskStore,
  saveTaskDraftVersion,
  saveTaskFileRecords,
  saveTaskOutlineVersion,
  saveTaskOutputRecord,
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
    resetTaskDraftStore();
    resetTaskOutputStore();
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
        warnings: [],
        analysisRenderMode: "structured",
        rawModelResponse: null,
        providerStatusCode: null,
        providerErrorBody: null,
        providerErrorKind: null
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
    expect(String(payload.message)).toContain("完整写作要求");
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

  it("returns persisted provider error details so refresh can still show the upstream raw body", async () => {
    saveTaskSummary({
      id: "task-provider-http-error",
      userId: "user-1",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: "",
      analysisStatus: "failed",
      analysisErrorMessage: "PROVIDER_HTTP_ERROR",
      analysisSnapshot: {
        chosenTaskFileId: null,
        supportingFileIds: [],
        ignoredFileIds: [],
        needsUserConfirmation: false,
        reasoning: "上游接口返回了错误正文。",
        targetWordCount: 2000,
        citationStyle: "APA 7",
        topic: null,
        chapterCount: null,
        mustCover: [],
        gradingFocus: [],
        appliedSpecialRequirements: "",
        usedDefaultWordCount: true,
        usedDefaultCitationStyle: true,
        warnings: [],
        analysisRenderMode: "raw_provider_error",
        rawModelResponse: null,
        providerStatusCode: 502,
        providerErrorBody: '{"error":{"message":"bad gateway from upstream"}}',
        providerErrorKind: "http_error"
      }
    });

    const response = await handleTaskAnalysisStatusRequest(
      new Request("http://localhost/api/tasks/task-provider-http-error/analysis"),
      { taskId: "task-provider-http-error" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser()
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.analysisStatus).toBe("failed");
    expect(payload.analysisRenderMode).toBe("raw_provider_error");
    expect(payload.providerStatusCode).toBe(502);
    expect(String(payload.providerErrorBody)).toContain("bad gateway from upstream");
    expect(String(payload.message)).toContain("原始回复");
  });

  it("labels persisted invalid_json_schema failures as system request-format bugs", async () => {
    const providerErrorBody = JSON.stringify({
      error: {
        message:
          "Invalid schema for response_format 'task_analysis_and_outline_result': missing required targetWordCount",
        type: "invalid_request_error",
        param: "text.format.schema",
        code: "invalid_json_schema"
      }
    });

    saveTaskSummary({
      id: "task-invalid-json-schema",
      userId: "user-1",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: "",
      analysisStatus: "failed",
      analysisErrorMessage: "PROVIDER_HTTP_ERROR",
      analysisSnapshot: {
        chosenTaskFileId: null,
        supportingFileIds: [],
        ignoredFileIds: [],
        needsUserConfirmation: false,
        reasoning: "这次不是文件问题，是系统请求格式写错了。",
        targetWordCount: 2000,
        citationStyle: "APA 7",
        topic: null,
        chapterCount: null,
        mustCover: [],
        gradingFocus: [],
        appliedSpecialRequirements: "",
        usedDefaultWordCount: true,
        usedDefaultCitationStyle: true,
        warnings: [],
        analysisRenderMode: "raw_provider_error",
        rawModelResponse: null,
        providerStatusCode: 400,
        providerErrorBody,
        providerErrorKind: "http_error"
      }
    });

    const response = await handleTaskAnalysisStatusRequest(
      new Request("http://localhost/api/tasks/task-invalid-json-schema/analysis"),
      { taskId: "task-invalid-json-schema" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser()
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.analysisRenderMode).toBe("raw_provider_error");
    expect(payload.providerStatusCode).toBe(400);
    expect(String(payload.providerErrorBody)).toContain("invalid_json_schema");
    expect(String(payload.message)).toContain("系统");
    expect(String(payload.message)).toContain("格式");
  });

  it("keeps pending_version inside the startup grace window as pending", async () => {
    process.env.TRIGGER_SECRET_KEY = "tr_prod_example";
    process.env.VERCEL_ENV = "production";

    saveTaskSummary({
      id: "task-pending-version",
      userId: "user-1",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: "",
      analysisStatus: "pending",
      analysisRequestedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
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
    expect(String(payload.message)).toContain("后台分析");
    expect(payload.analysisProgress.canRetry).toBe(false);
    expect(getTaskSummary("task-pending-version")?.analysisTriggerRunId).toBe("run-pending-version");
    expect(getTaskSummary("task-pending-version")?.analysisErrorMessage).toBeUndefined();
  });

  it("marks startup stalled after the grace window when pending_version still never really starts", async () => {
    process.env.TRIGGER_SECRET_KEY = "tr_prod_example";
    process.env.VERCEL_ENV = "production";

    saveTaskSummary({
      id: "task-pending-version-stalled",
      userId: "user-1",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: "",
      analysisStatus: "pending",
      analysisRequestedAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
      analysisTriggerRunId: "run-pending-version-stalled"
    });

    const response = await handleTaskAnalysisStatusRequest(
      new Request("http://localhost/api/tasks/task-pending-version-stalled/analysis"),
      { taskId: "task-pending-version-stalled" },
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
    expect(payload.analysisStatus).toBe("failed");
    expect(payload.analysisRuntime.state).toBe("not_applicable");
    expect(String(payload.message)).toContain("后台分析没有真正启动成功");
    expect(payload.analysisProgress.canRetry).toBe(true);
    expect(getTaskSummary("task-pending-version-stalled")?.analysisTriggerRunId).toBeNull();
    expect(getTaskSummary("task-pending-version-stalled")?.analysisErrorMessage).toBe(
      "TRIGGER_STARTUP_STALLED"
    );
  });

  it("uses analysis_error_message as the main failed hint even when snapshot warnings are empty", async () => {
    saveTaskSummary({
      id: "task-failed-error-field",
      userId: "user-1",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: "",
      analysisStatus: "failed",
      analysisModel: "gpt-5.2",
      analysisErrorMessage: "STALE_TRIGGER_RUN",
      analysisSnapshot: null
    });

    const response = await handleTaskAnalysisStatusRequest(
      new Request("http://localhost/api/tasks/task-failed-error-field/analysis"),
      { taskId: "task-failed-error-field" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser()
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.analysisStatus).toBe("failed");
    expect(String(payload.message)).toContain("旧的后台任务编号");
    expect(String(payload.message)).toContain("一键重试分析");
  });

  it("returns deliverable downloads and final word count after the writing pipeline finishes", async () => {
    saveTaskSummary({
      id: "task-ready",
      userId: "user-1",
      status: "deliverable_ready",
      targetWordCount: 1000,
      citationStyle: "Harvard",
      specialRequirements: "",
      latestOutlineVersionId: "outline-ready",
      latestDraftVersionId: "draft-ready",
      analysisStatus: "succeeded"
    });

    saveTaskOutlineVersion({
      id: "outline-ready",
      taskId: "task-ready",
      userId: "user-1",
      versionNumber: 1,
      outline: {
        articleTitle: "Sample title",
        targetWordCount: 1000,
        citationStyle: "Harvard",
        chineseMirrorPending: true,
        sections: [
          {
            title: "Introduction",
            summary: "Intro",
            bulletPoints: ["a", "b", "c"]
          }
        ]
      },
      feedback: "",
      isApproved: true,
      targetWordCount: 1000,
      citationStyle: "Harvard"
    });

    saveTaskDraftVersion({
      id: "draft-ready",
      taskId: "task-ready",
      userId: "user-1",
      versionNumber: 1,
      title: "Sample title",
      bodyMarkdown: "A finished body paragraph.",
      bodyWordCount: 1004,
      referencesMarkdown: "Author. (2024). Source.",
      isActive: true,
      isCandidate: false
    });

    saveTaskOutputRecord({
      id: "out-final",
      taskId: "task-ready",
      userId: "user-1",
      outputKind: "final_docx",
      storagePath: "users/user-1/tasks/task-ready/outputs/final.docx"
    });

    saveTaskOutputRecord({
      id: "out-report",
      taskId: "task-ready",
      userId: "user-1",
      outputKind: "reference_report_pdf",
      storagePath: "users/user-1/tasks/task-ready/outputs/reference-report.pdf"
    });

    const response = await handleTaskAnalysisStatusRequest(
      new Request("http://localhost/api/tasks/task-ready/analysis"),
      { taskId: "task-ready" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser()
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.task.status).toBe("deliverable_ready");
    expect(payload.downloads.finalDocxOutputId).toBe("out-final");
    expect(payload.downloads.referenceReportOutputId).toBe("out-report");
    expect(payload.finalWordCount).toBe(1004);
  });

  it("does not query or expose downloads while the task is still drafting", async () => {
    saveTaskSummary({
      id: "task-drafting",
      userId: "user-1",
      status: "drafting",
      targetWordCount: 1000,
      citationStyle: "Harvard",
      specialRequirements: "",
      latestOutlineVersionId: "outline-drafting",
      latestDraftVersionId: "draft-drafting",
      analysisStatus: "succeeded",
      lastWorkflowStage: "drafting"
    } as any);

    saveTaskDraftVersion({
      id: "draft-drafting",
      taskId: "task-drafting",
      userId: "user-1",
      versionNumber: 1,
      title: "Sample title",
      bodyMarkdown: "A partial body paragraph.",
      bodyWordCount: 402,
      referencesMarkdown: "",
      isActive: true,
      isCandidate: false
    });

    saveTaskOutputRecord({
      id: "out-drafting-final",
      taskId: "task-drafting",
      userId: "user-1",
      outputKind: "final_docx",
      storagePath: "users/user-1/tasks/task-drafting/outputs/final.docx"
    });

    const response = await handleTaskAnalysisStatusRequest(
      new Request("http://localhost/api/tasks/task-drafting/analysis"),
      { taskId: "task-drafting" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser()
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.task.status).toBe("drafting");
    expect(payload.task.lastWorkflowStage).toBe("drafting");
    expect(payload.downloads.finalDocxOutputId).toBeNull();
    expect(payload.downloads.referenceReportOutputId).toBeNull();
    expect(payload.finalWordCount).toBeNull();
  });

  it("returns the last workflow stage when a post-approval task fails", async () => {
    saveTaskSummary({
      id: "task-post-approval-failed",
      userId: "user-1",
      status: "failed",
      targetWordCount: 1200,
      citationStyle: "Harvard",
      specialRequirements: "",
      latestOutlineVersionId: "outline-failed",
      latestDraftVersionId: "draft-failed",
      analysisStatus: "succeeded",
      lastWorkflowStage: "verifying_references"
    } as any);

    saveTaskDraftVersion({
      id: "draft-failed",
      taskId: "task-post-approval-failed",
      userId: "user-1",
      versionNumber: 1,
      title: "Sample title",
      bodyMarkdown: "A nearly finished body paragraph.",
      bodyWordCount: 1189,
      referencesMarkdown: "Author. (2024). Source.",
      isActive: true,
      isCandidate: false
    });

    const response = await handleTaskAnalysisStatusRequest(
      new Request("http://localhost/api/tasks/task-post-approval-failed/analysis"),
      { taskId: "task-post-approval-failed" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser()
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.task.status).toBe("failed");
    expect(payload.task.lastWorkflowStage).toBe("verifying_references");
    expect(String(payload.message)).toContain("正文");
  });
});

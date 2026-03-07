import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { handleTaskAnalysisRetryRequest } from "../../app/api/tasks/[taskId]/analysis/retry/route";
import {
  resetTaskFileStore,
  resetTaskStore,
  saveTaskFileRecords,
  saveTaskSummary
} from "../../src/lib/tasks/repository";
import type { InlineFirstOutlineResult } from "../../src/lib/tasks/inline-first-outline";

function makeUser() {
  return {
    id: "user-1",
    email: "user-1@example.com",
    role: "user" as const
  };
}

function makeSucceededInlineResult(
  overrides: Partial<InlineFirstOutlineResult> = {}
): InlineFirstOutlineResult {
  return {
    task: {
      id: "task-1",
      status: "awaiting_outline_approval",
      targetWordCount: 1800,
      citationStyle: "Harvard",
      specialRequirements: "Focus on finance."
    },
    taskSummary: {
      id: "task-1",
      userId: "user-1",
      status: "awaiting_outline_approval",
      targetWordCount: 1800,
      citationStyle: "Harvard",
      specialRequirements: "Focus on finance.",
      analysisStatus: "succeeded",
      analysisModel: "gpt-5.2",
      analysisRetryCount: 1,
      analysisRequestedAt: new Date().toISOString(),
      analysisStartedAt: new Date().toISOString(),
      analysisCompletedAt: new Date().toISOString(),
      analysisErrorMessage: null,
      analysisTriggerRunId: null,
      analysisSnapshot: {
        chosenTaskFileId: "file-1",
        supportingFileIds: [],
        ignoredFileIds: [],
        needsUserConfirmation: false,
        reasoning: "The uploaded brief explicitly requires a Harvard-style finance essay.",
        targetWordCount: 1800,
        citationStyle: "Harvard",
        topic: "Finance Risk Management",
        chapterCount: 4,
        mustCover: ["Risk identification", "Control framework"],
        gradingFocus: ["Critical analysis"],
        appliedSpecialRequirements: "Focus on finance.",
        usedDefaultWordCount: false,
        usedDefaultCitationStyle: false,
        warnings: [],
        analysisRenderMode: "structured",
        rawModelResponse: null
      },
      latestOutlineVersionId: "outline-1",
      primaryRequirementFileId: "file-1"
    },
    files: [
      {
        id: "file-1",
        taskId: "task-1",
        userId: "user-1",
        originalFilename: "assignment.txt",
        storagePath: "tmp/assignment.txt",
        extractedText: "Assignment brief text.",
        role: "requirement",
        isPrimary: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    classification: {
      primaryRequirementFileId: "file-1",
      backgroundFileIds: [],
      irrelevantFileIds: [],
      needsUserConfirmation: false,
      reasoning: "The uploaded brief explicitly requires a Harvard-style finance essay."
    },
    analysisStatus: "succeeded",
    analysisProgress: {
      requestedAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      elapsedSeconds: 2,
      maxWaitSeconds: 600,
      canRetry: false
    },
    analysisRuntime: {
      state: "not_applicable",
      status: null,
      detail: "首版大纲这一步已经在当前请求里直接完成，不再走后台排队。",
      autoRecovered: false,
      runId: null
    },
    analysis: {
      chosenTaskFileId: "file-1",
      supportingFileIds: [],
      ignoredFileIds: [],
      needsUserConfirmation: false,
      reasoning: "The uploaded brief explicitly requires a Harvard-style finance essay.",
      targetWordCount: 1800,
      citationStyle: "Harvard",
      topic: "Finance Risk Management",
      chapterCount: 4,
      mustCover: ["Risk identification", "Control framework"],
      gradingFocus: ["Critical analysis"],
      appliedSpecialRequirements: "Focus on finance.",
      usedDefaultWordCount: false,
      usedDefaultCitationStyle: false,
      warnings: [],
      analysisRenderMode: "structured",
      rawModelResponse: null
    },
    analysisRenderMode: "structured",
    rawModelResponse: null,
    ruleCard: {
      topic: "Finance Risk Management",
      targetWordCount: 1800,
      citationStyle: "Harvard",
      chapterCountOverride: 4,
      mustAnswer: ["Risk identification", "Control framework"],
      gradingPriorities: ["Critical analysis"],
      specialRequirements: "Focus on finance."
    },
    outline: {
      articleTitle: "Finance Risk Management in Modern Banking",
      targetWordCount: 1800,
      citationStyle: "Harvard",
      chineseMirrorPending: true,
      sections: [
        {
          title: "Introduction",
          summary: "Introduce the finance risk management problem and essay scope.",
          bulletPoints: ["Define the scope", "Set the academic focus", "State the argument"]
        }
      ]
    },
    humanize: {
      status: "idle",
      provider: "undetectable",
      requestedAt: null,
      completedAt: null,
      errorMessage: null
    },
    ...overrides
  };
}

function makeRawInlineResult(
  overrides: Partial<InlineFirstOutlineResult> = {}
): InlineFirstOutlineResult {
  const rawModelResponse = [
    "I can draft this paper around finance risk governance.",
    "Suggested structure:",
    "1. Introduction",
    "2. Governance framework",
    "3. Regional banking cases"
  ].join("\n");

  return {
    ...makeSucceededInlineResult(),
    task: {
      id: "task-raw",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: ""
    },
    taskSummary: {
      ...makeSucceededInlineResult().taskSummary,
      id: "task-raw",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: "",
      analysisStatus: "failed",
      analysisErrorMessage: "MODEL_RAW_RESPONSE_ONLY",
      latestOutlineVersionId: null,
      analysisSnapshot: {
        chosenTaskFileId: "file-1",
        supportingFileIds: [],
        ignoredFileIds: [],
        needsUserConfirmation: false,
        reasoning: "The model returned readable content, but not a formal outline payload.",
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
        analysisRenderMode: "raw",
        rawModelResponse
      }
    },
    analysisStatus: "failed",
    analysis: {
      chosenTaskFileId: "file-1",
      supportingFileIds: [],
      ignoredFileIds: [],
      needsUserConfirmation: false,
      reasoning: "The model returned readable content, but not a formal outline payload.",
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
      analysisRenderMode: "raw",
      rawModelResponse
    },
    analysisRenderMode: "raw",
    rawModelResponse,
    ruleCard: null,
    outline: null,
    ...overrides
  };
}

describe("analysis retry route", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    process.env.TRIGGER_SECRET_KEY = "trigger-secret";
    process.env.VERCEL_ENV = "";
    resetTaskStore();
    resetTaskFileStore();
  });

  it("returns pending when a legacy background run is still active", async () => {
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
        isPrimary: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]);

    const runInlineFirstOutline = vi.fn();
    const response = await handleTaskAnalysisRetryRequest(
      new Request("http://localhost/api/tasks/task-active-run/analysis/retry", {
        method: "POST"
      }),
      { taskId: "task-active-run" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        getTriggerRunState: async () => ({ state: "active", status: "EXECUTING" }),
        runInlineFirstOutline
      } as never
    );
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload.analysisStatus).toBe("pending");
    expect(String(payload.message)).toContain("避免重复处理");
    expect(runInlineFirstOutline).not.toHaveBeenCalled();
  });

  it("returns the regenerated outline directly when retry succeeds", async () => {
    saveTaskSummary({
      id: "task-retry-success",
      userId: "user-1",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: "",
      analysisStatus: "failed",
      analysisErrorMessage: "MODEL_RAW_RESPONSE_ONLY"
    });

    saveTaskFileRecords([
      {
        id: "file-1",
        taskId: "task-retry-success",
        userId: "user-1",
        originalFilename: "brief.txt",
        storagePath: "tmp/brief.txt",
        extractedText: "brief",
        role: "unknown",
        isPrimary: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]);

    const runInlineFirstOutline = vi.fn().mockResolvedValue(
      makeSucceededInlineResult({
        task: {
          id: "task-retry-success",
          status: "awaiting_outline_approval",
          targetWordCount: 1800,
          citationStyle: "Harvard",
          specialRequirements: ""
        },
        taskSummary: {
          ...makeSucceededInlineResult().taskSummary,
          id: "task-retry-success",
          specialRequirements: "",
          status: "awaiting_outline_approval"
        }
      })
    );

    const response = await handleTaskAnalysisRetryRequest(
      new Request("http://localhost/api/tasks/task-retry-success/analysis/retry", {
        method: "POST"
      }),
      { taskId: "task-retry-success" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        runInlineFirstOutline
      } as never
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.analysisStatus).toBe("succeeded");
    expect(payload.analysisRenderMode).toBe("structured");
    expect(payload.outline?.articleTitle).toContain("Finance");
    expect(runInlineFirstOutline).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "task-retry-success",
        userId: "user-1",
        source: "manual_retry"
      })
    );
  });

  it("returns raw fallback when retry still only gets readable model text", async () => {
    saveTaskSummary({
      id: "task-retry-raw",
      userId: "user-1",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: "",
      analysisStatus: "failed",
      analysisErrorMessage: "MODEL_RAW_RESPONSE_ONLY"
    });

    saveTaskFileRecords([
      {
        id: "file-1",
        taskId: "task-retry-raw",
        userId: "user-1",
        originalFilename: "brief.txt",
        storagePath: "tmp/brief.txt",
        extractedText: "brief",
        role: "unknown",
        isPrimary: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]);

    const response = await handleTaskAnalysisRetryRequest(
      new Request("http://localhost/api/tasks/task-retry-raw/analysis/retry", {
        method: "POST"
      }),
      { taskId: "task-retry-raw" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        runInlineFirstOutline: vi.fn().mockResolvedValue(
          makeRawInlineResult({
            task: {
              id: "task-retry-raw",
              status: "created",
              targetWordCount: null,
              citationStyle: null,
              specialRequirements: ""
            },
            taskSummary: {
              ...makeRawInlineResult().taskSummary,
              id: "task-retry-raw",
              specialRequirements: ""
            }
          })
        )
      } as never
    );
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.analysisStatus).toBe("failed");
    expect(payload.analysisRenderMode).toBe("raw");
    expect(String(payload.rawModelResponse)).toContain("Suggested structure");
    expect(String(payload.message)).toContain("原始回复");
    expect(payload.outline).toBeNull();
  });

  it("rejects retry when there are no uploaded files", async () => {
    saveTaskSummary({
      id: "task-no-files",
      userId: "user-1",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: "",
      analysisStatus: "failed"
    });

    const response = await handleTaskAnalysisRetryRequest(
      new Request("http://localhost/api/tasks/task-no-files/analysis/retry", {
        method: "POST"
      }),
      { taskId: "task-no-files" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser()
      } as never
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(String(payload.message)).toContain("没有可用文件");
  });
});

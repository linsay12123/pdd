import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { handleTaskFileUploadRequest } from "../../app/api/tasks/[taskId]/files/route";
import { handleConfirmPrimaryFileRequest } from "../../app/api/tasks/[taskId]/files/confirm-primary/route";
import {
  getTaskSummary,
  listTaskFiles,
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
      analysisRetryCount: 0,
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
      latestOutlineVersionId: "outline-1"
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
      specialRequirements: "Focus on finance."
    },
    taskSummary: {
      ...makeSucceededInlineResult().taskSummary,
      id: "task-raw",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      analysisStatus: "failed",
      analysisErrorMessage: "MODEL_RAW_RESPONSE_ONLY",
      latestOutlineVersionId: null,
      analysisSnapshot: {
        chosenTaskFileId: null,
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
        appliedSpecialRequirements: "Focus on finance.",
        usedDefaultWordCount: true,
        usedDefaultCitationStyle: true,
        warnings: [],
        analysisRenderMode: "raw",
        rawModelResponse
      }
    },
    analysisStatus: "failed",
    analysis: {
      chosenTaskFileId: null,
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
      appliedSpecialRequirements: "Focus on finance.",
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

function makeFailedInlineResult(
  overrides: Partial<InlineFirstOutlineResult> = {}
): InlineFirstOutlineResult {
  const succeeded = makeSucceededInlineResult();
  return {
    ...succeeded,
    task: {
      ...succeeded.task,
      status: "created"
    },
    taskSummary: {
      ...succeeded.taskSummary,
      status: "created",
      analysisStatus: "failed",
      analysisErrorMessage: "MODEL_INPUT_NOT_READY",
      latestOutlineVersionId: null,
      analysisSnapshot: null
    },
    analysisStatus: "failed",
    analysis: null,
    analysisRenderMode: null,
    rawModelResponse: null,
    ruleCard: null,
    outline: null,
    ...overrides
  };
}

describe("task file first-outline routes", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    process.env.TRIGGER_SECRET_KEY = "trigger-secret";
    process.env.VERCEL_ENV = "preview";
    resetTaskStore();
    resetTaskFileStore();
  });

  it("rejects files that exceed the configured upload size limit", async () => {
    saveTaskSummary({
      id: "task-too-large",
      userId: "user-1",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: ""
    });

    const formData = new FormData();
    formData.append("files", new File(["abcde"], "assignment.txt", { type: "text/plain" }));

    const response = await handleTaskFileUploadRequest(
      new Request("http://localhost/api/tasks/task-too-large/files", {
        method: "POST",
        body: formData
      }),
      { taskId: "task-too-large" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        maxFileBytes: 4
      } as never
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(String(payload.message)).toContain("超过");
    expect(getTaskSummary("task-too-large")?.analysisStatus).not.toBe("pending");
  });

  it("returns the first outline directly after upload instead of entering fake pending", async () => {
    saveTaskSummary({
      id: "task-1",
      userId: "user-1",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: "Focus on finance."
    });

    const formData = new FormData();
    formData.append(
      "files",
      new File(["Assignment brief text."], "assignment.txt", { type: "text/plain" })
    );

    const runInlineFirstOutline = vi.fn().mockResolvedValue(makeSucceededInlineResult());

    const response = await handleTaskFileUploadRequest(
      new Request("http://localhost/api/tasks/task-1/files", {
        method: "POST",
        body: formData
      }),
      { taskId: "task-1" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        runInlineFirstOutline
      } as never
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(payload.analysisStatus).toBe("succeeded");
    expect(payload.analysisRenderMode).toBe("structured");
    expect(payload.rawModelResponse).toBeNull();
    expect(payload.outline?.articleTitle).toContain("Finance");
    expect(payload.ruleCard?.citationStyle).toBe("Harvard");
    expect(payload.analysisRuntime.state).toBe("not_applicable");
    expect(runInlineFirstOutline).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "task-1",
        userId: "user-1",
        source: "upload"
      })
    );
    expect(listTaskFiles("task-1")).toHaveLength(1);
  });

  it("returns raw fallback details when upload analysis only gets a readable model reply", async () => {
    saveTaskSummary({
      id: "task-inline-raw",
      userId: "user-1",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: "Focus on finance."
    });

    const formData = new FormData();
    formData.append(
      "files",
      new File(["Assignment brief text."], "assignment.txt", { type: "text/plain" })
    );

    const response = await handleTaskFileUploadRequest(
      new Request("http://localhost/api/tasks/task-inline-raw/files", {
        method: "POST",
        body: formData
      }),
      { taskId: "task-inline-raw" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        runInlineFirstOutline: vi.fn().mockResolvedValue(
          makeRawInlineResult({
            task: {
              id: "task-inline-raw",
              status: "created",
              targetWordCount: null,
              citationStyle: null,
              specialRequirements: "Focus on finance."
            },
            taskSummary: {
              ...makeRawInlineResult().taskSummary,
              id: "task-inline-raw",
              specialRequirements: "Focus on finance."
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

  it("returns 400 when the files never became model-ready inputs", async () => {
    saveTaskSummary({
      id: "task-input-not-ready",
      userId: "user-1",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: ""
    });

    const formData = new FormData();
    formData.append(
      "files",
      new File(["Assignment brief text."], "assignment.pdf", { type: "application/pdf" })
    );

    const response = await handleTaskFileUploadRequest(
      new Request("http://localhost/api/tasks/task-input-not-ready/files", {
        method: "POST",
        body: formData
      }),
      { taskId: "task-input-not-ready" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        runInlineFirstOutline: vi.fn().mockResolvedValue(
          makeFailedInlineResult({
            task: {
              id: "task-input-not-ready",
              status: "created",
              targetWordCount: null,
              citationStyle: null,
              specialRequirements: ""
            },
            taskSummary: {
              ...makeFailedInlineResult().taskSummary,
              id: "task-input-not-ready",
              specialRequirements: "",
              analysisErrorMessage: "MODEL_INPUT_NOT_READY"
            }
          })
        )
      } as never
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(String(payload.message)).toContain("文件完整交给分析模型");
  });

  it("keeps pdf transport-only strategy while still returning the outline directly", async () => {
    saveTaskSummary({
      id: "task-pdf",
      userId: "user-1",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: ""
    });

    const formData = new FormData();
    formData.append(
      "files",
      new File([new Uint8Array([37, 80, 68, 70])], "assignment.pdf", {
        type: "application/pdf"
      })
    );

    const response = await handleTaskFileUploadRequest(
      new Request("http://localhost/api/tasks/task-pdf/files", {
        method: "POST",
        body: formData
      }),
      { taskId: "task-pdf" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        runInlineFirstOutline: vi.fn().mockResolvedValue(
          makeSucceededInlineResult({
            task: {
              id: "task-pdf",
              status: "awaiting_outline_approval",
              targetWordCount: 1800,
              citationStyle: "Harvard",
              specialRequirements: ""
            },
            taskSummary: {
              ...makeSucceededInlineResult().taskSummary,
              id: "task-pdf",
              specialRequirements: ""
            }
          })
        )
      } as never
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(listTaskFiles("task-pdf")[0]?.extractionMethod).toBe("transport_only_pdf");
    expect(payload.analysisStatus).toBe("succeeded");
  });

  it("returns raw fallback after the user confirms the main task file and the model still only replies in plain text", async () => {
    saveTaskSummary({
      id: "task-confirm",
      userId: "user-1",
      status: "awaiting_primary_file_confirmation",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: ""
    });

    saveTaskFileRecords([
      {
        id: "file-1",
        taskId: "task-confirm",
        userId: "user-1",
        originalFilename: "brief-a.txt",
        storagePath: "tmp/brief-a.txt",
        extractedText: "A brief",
        role: "unknown",
        isPrimary: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]);

    const runInlineFirstOutline = vi.fn().mockResolvedValue(
      makeRawInlineResult({
        task: {
          id: "task-confirm",
          status: "created",
          targetWordCount: null,
          citationStyle: null,
          specialRequirements: ""
        },
        taskSummary: {
          ...makeRawInlineResult().taskSummary,
          id: "task-confirm",
          specialRequirements: ""
        },
        files: [
          {
            id: "file-1",
            taskId: "task-confirm",
            userId: "user-1",
            originalFilename: "brief-a.txt",
            storagePath: "tmp/brief-a.txt",
            extractedText: "A brief",
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
          reasoning: "The confirmed file is the requirement brief."
        }
      })
    );

    const response = await handleConfirmPrimaryFileRequest(
      new Request("http://localhost/api/tasks/task-confirm/files/confirm-primary", {
        method: "POST",
        body: JSON.stringify({ fileId: "file-1" }),
        headers: {
          "content-type": "application/json"
        }
      }),
      { taskId: "task-confirm" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        runInlineFirstOutline
      } as never
    );
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.analysisStatus).toBe("failed");
    expect(payload.primaryRequirementFileId).toBe("file-1");
    expect(payload.analysisRenderMode).toBe("raw");
    expect(String(payload.rawModelResponse)).toContain("Suggested structure");
    expect(runInlineFirstOutline).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "task-confirm",
        userId: "user-1",
        source: "confirm_primary",
        forcedPrimaryFileId: "file-1"
      })
    );
  });
});

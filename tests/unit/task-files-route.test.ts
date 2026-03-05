import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { handleTaskFileUploadRequest } from "../../app/api/tasks/[taskId]/files/route";
import { handleConfirmPrimaryFileRequest } from "../../app/api/tasks/[taskId]/files/confirm-primary/route";
import {
  getTaskSummary,
  listTaskFiles,
  resetTaskFileStore,
  resetTaskStore,
  saveTaskSummary
} from "../../src/lib/tasks/repository";

function makeUser() {
  return {
    id: "user-1",
    email: "user-1@example.com",
    role: "user" as const
  };
}

function makeOutline(overrides: Record<string, unknown> = {}) {
  return {
    articleTitle: "Finance Risk Governance in ASEAN Banks",
    targetWordCount: 2750,
    citationStyle: "Harvard",
    chineseMirrorPending: true,
    chineseMirror: null,
    sections: [
      {
        title: "Introduction",
        summary: "Introduce the finance risk governance problem and the essay scope.",
        bulletPoints: [
          "Set the regional context",
          "Define the risk governance focus",
          "State the central argument"
        ]
      },
      {
        title: "Governance Failures",
        summary: "Explain the specific governance failures that increase finance risk exposure.",
        bulletPoints: [
          "Weak board oversight",
          "Poor risk escalation",
          "Control design gaps"
        ]
      }
    ],
    ...overrides
  };
}

function makeAnalysis(overrides: Record<string, unknown> = {}) {
  return {
    chosenTaskFileId: "file-1",
    supportingFileIds: [],
    ignoredFileIds: [],
    needsUserConfirmation: false,
    reasoning: "The assignment brief contains the hard requirements for the essay.",
    targetWordCount: 2750,
    citationStyle: "Harvard",
    topic: "Finance Risk Governance in ASEAN Banks",
    chapterCount: 6,
    mustCover: ["Risk governance", "ASEAN banking"],
    gradingFocus: ["Critical analysis", "Evidence-based argument"],
    appliedSpecialRequirements: "Focus on ASEAN banking examples.",
    usedDefaultWordCount: false,
    usedDefaultCitationStyle: false,
    warnings: [],
    ...overrides
  };
}

describe("task file routes", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    resetTaskStore();
    resetTaskFileStore();
  });

  it("persists uploaded files and returns the model analysis plus a non-empty outline", async () => {
    saveTaskSummary({
      id: "task-1",
      userId: "user-1",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: "Focus on ASEAN banking examples."
    });

    const formData = new FormData();
    formData.append(
      "files",
      new File(
        [
          "Assessment brief. Write 2750 words. Use Harvard referencing. Focus on ASEAN banking risk governance."
        ],
        "assignment.txt",
        { type: "text/plain" }
      )
    );
    formData.append(
      "files",
      new File(
        ["Background reading about ASEAN banking regulation and board oversight."],
        "background.txt",
        { type: "text/plain" }
      )
    );

    const response = await handleTaskFileUploadRequest(
      new Request("http://localhost/api/tasks/task-1/files", {
        method: "POST",
        body: formData
      }),
      {
        taskId: "task-1"
      },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        analyzeTask: async ({ files }) => ({
          analysis: makeAnalysis({
            chosenTaskFileId: files[0]?.id,
            supportingFileIds: files[1] ? [files[1].id] : []
          }),
          outline: makeOutline()
        })
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.analysis.targetWordCount).toBe(2750);
    expect(payload.analysis.citationStyle).toBe("Harvard");
    expect(payload.analysis.usedDefaultWordCount).toBe(false);
    expect(payload.classification.primaryRequirementFileId).toBe(payload.files[0].id);
    expect(payload.classification.needsUserConfirmation).toBe(false);
    expect(payload.task.status).toBe("awaiting_outline_approval");
    expect(payload.task.targetWordCount).toBe(2750);
    expect(payload.task.citationStyle).toBe("Harvard");
    expect(payload.ruleCard.targetWordCount).toBe(2750);
    expect(payload.ruleCard.citationStyle).toBe("Harvard");
    expect(payload.outline.articleTitle).toBe("Finance Risk Governance in ASEAN Banks");
    expect(payload.outline.sections.length).toBeGreaterThan(0);

    const files = listTaskFiles("task-1");
    expect(files).toHaveLength(2);
    expect(files.find((file) => file.isPrimary)?.role).toBe("requirement");
    expect(files.find((file) => !file.isPrimary)?.role).toBe("background");
    expect(getTaskSummary("task-1")?.primaryRequirementFileId).toBe(
      payload.classification.primaryRequirementFileId
    );
    expect(getTaskSummary("task-1")?.targetWordCount).toBe(2750);
  });

  it("lets the model ask for primary-file confirmation before generating an outline", async () => {
    saveTaskSummary({
      id: "task-2",
      userId: "user-1",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: ""
    });

    const formData = new FormData();
    formData.append(
      "files",
      new File(
        ["Assignment brief. Write 1800 words. Use APA 7."],
        "assignment-a.txt",
        { type: "text/plain" }
      )
    );
    formData.append(
      "files",
      new File(
        ["Assessment requirements. Write 2000 words. Use Harvard."],
        "assignment-b.txt",
        { type: "text/plain" }
      )
    );

    const response = await handleTaskFileUploadRequest(
      new Request("http://localhost/api/tasks/task-2/files", {
        method: "POST",
        body: formData
      }),
      {
        taskId: "task-2"
      },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        analyzeTask: async ({ files }) => ({
          analysis: makeAnalysis({
            chosenTaskFileId: null,
            supportingFileIds: files.map((file) => file.id),
            needsUserConfirmation: true,
            reasoning: "Two files both look like assignment briefs, so the model needs user confirmation.",
            targetWordCount: 2000,
            citationStyle: "APA 7",
            topic: "Pending task file confirmation",
            chapterCount: null,
            mustCover: [],
            gradingFocus: [],
            appliedSpecialRequirements: "",
            usedDefaultWordCount: false,
            usedDefaultCitationStyle: false
          }),
          outline: null
        })
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.analysis.chosenTaskFileId).toBeNull();
    expect(payload.analysis.needsUserConfirmation).toBe(true);
    expect(payload.classification.primaryRequirementFileId).toBe(null);
    expect(payload.classification.needsUserConfirmation).toBe(true);
    expect(payload.task.status).toBe("awaiting_primary_file_confirmation");
    expect(payload.ruleCard).toBeNull();
    expect(payload.outline).toBeNull();
  });

  it("re-runs model analysis after the user confirms the primary file", async () => {
    saveTaskSummary({
      id: "task-3",
      userId: "user-1",
      status: "awaiting_primary_file_confirmation",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: ""
    });

    const formData = new FormData();
    formData.append(
      "files",
      new File(
        ["Assignment brief. Write 1800 words. Use APA 7."],
        "assignment-a.txt",
        { type: "text/plain" }
      )
    );
    formData.append(
      "files",
      new File(
        ["Assessment requirements. Write 2750 words. Citation style: Harvard."],
        "assignment-b.txt",
        { type: "text/plain" }
      )
    );

    const uploadResponse = await handleTaskFileUploadRequest(
      new Request("http://localhost/api/tasks/task-3/files", {
        method: "POST",
        body: formData
      }),
      {
        taskId: "task-3"
      },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        analyzeTask: async ({ files }) => ({
          analysis: makeAnalysis({
            chosenTaskFileId: null,
            supportingFileIds: files.map((file) => file.id),
            needsUserConfirmation: true,
            reasoning: "The model needs the user to confirm which brief is the real task file.",
            targetWordCount: 2000,
            citationStyle: "APA 7",
            topic: "Pending task file confirmation",
            chapterCount: null,
            mustCover: [],
            gradingFocus: [],
            appliedSpecialRequirements: "",
            usedDefaultWordCount: false,
            usedDefaultCitationStyle: false
          }),
          outline: null
        })
      }
    );
    const uploadPayload = await uploadResponse.json();
    const selectedFileId = uploadPayload.files[1].id;

    const confirmResponse = await handleConfirmPrimaryFileRequest(
      new Request("http://localhost/api/tasks/task-3/files/confirm-primary", {
        method: "POST",
        body: JSON.stringify({
          fileId: selectedFileId
        }),
        headers: {
          "content-type": "application/json"
        }
      }),
      {
        taskId: "task-3"
      },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        analyzeTask: async () => ({
          analysis: makeAnalysis({
            chosenTaskFileId: selectedFileId,
            targetWordCount: 2750,
            citationStyle: "Harvard",
            topic: "Finance Risk Governance in ASEAN Banks",
            chapterCount: 6
          }),
          outline: makeOutline()
        })
      }
    );
    const confirmPayload = await confirmResponse.json();

    expect(confirmResponse.status).toBe(200);
    expect(confirmPayload.task.status).toBe("awaiting_outline_approval");
    expect(confirmPayload.primaryRequirementFileId).toBe(selectedFileId);
    expect(confirmPayload.analysis.chosenTaskFileId).toBe(selectedFileId);
    expect(confirmPayload.analysis.targetWordCount).toBe(2750);
    expect(confirmPayload.ruleCard.targetWordCount).toBe(2750);
    expect(confirmPayload.ruleCard.citationStyle).toBe("Harvard");
    expect(confirmPayload.outline.sections.length).toBeGreaterThan(0);

    const files = listTaskFiles("task-3");
    expect(files.find((file) => file.id === selectedFileId)?.isPrimary).toBe(true);
    expect(files.find((file) => file.id === selectedFileId)?.role).toBe("requirement");
    expect(getTaskSummary("task-3")?.primaryRequirementFileId).toBe(selectedFileId);
    expect(getTaskSummary("task-3")?.citationStyle).toBe("Harvard");
    expect(confirmPayload.classification.primaryRequirementFileId).toBe(selectedFileId);
    expect(confirmPayload.classification.needsUserConfirmation).toBe(false);
  });

  it("rejects fake success when the model returns an empty outline after claiming no confirmation is needed", async () => {
    saveTaskSummary({
      id: "task-4",
      userId: "user-1",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: ""
    });

    const formData = new FormData();
    formData.append(
      "files",
      new File(
        ["Assignment brief. Write 2750 words. Use Harvard."],
        "assignment.txt",
        { type: "text/plain" }
      )
    );

    const response = await handleTaskFileUploadRequest(
      new Request("http://localhost/api/tasks/task-4/files", {
        method: "POST",
        body: formData
      }),
      {
        taskId: "task-4"
      },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        analyzeTask: async ({ files }) => ({
          analysis: makeAnalysis({
            chosenTaskFileId: files[0]?.id,
            supportingFileIds: [],
            needsUserConfirmation: false
          }),
          outline: makeOutline({
            sections: []
          })
        })
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(String(payload.message)).toContain("大纲");
  });

  it("rejects generic placeholder outlines instead of treating them as a successful first draft", async () => {
    saveTaskSummary({
      id: "task-5",
      userId: "user-1",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: ""
    });

    const formData = new FormData();
    formData.append(
      "files",
      new File(
        ["Assignment brief. Write 2750 words. Use Harvard."],
        "assignment.txt",
        { type: "text/plain" }
      )
    );

    const response = await handleTaskFileUploadRequest(
      new Request("http://localhost/api/tasks/task-5/files", {
        method: "POST",
        body: formData
      }),
      {
        taskId: "task-5"
      },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        analyzeTask: async ({ files }) => ({
          analysis: makeAnalysis({
            chosenTaskFileId: files[0]?.id,
            supportingFileIds: [],
            needsUserConfirmation: false
          }),
          outline: makeOutline({
            articleTitle: "General Academic Essay: A Structured Analysis",
            sections: [
              {
                title: "Introduction",
                summary:
                  "Introduction will explain how general academic essay develops in this section.",
                bulletPoints: [
                  "Introduction focus point 1",
                  "Introduction focus point 2",
                  "Introduction focus point 3"
                ]
              }
            ]
          })
        })
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(String(payload.message)).toContain("大纲");
  });

  it("returns 503 when the official task persistence pipeline is unavailable", async () => {
    const formData = new FormData();
    formData.append(
      "files",
      new File(["Assignment brief. Write 2750 words. Use Harvard."], "assignment.txt", {
        type: "text/plain"
      })
    );

    const response = await handleTaskFileUploadRequest(
      new Request("http://localhost/api/tasks/task-6/files", {
        method: "POST",
        body: formData
      }),
      {
        taskId: "task-6"
      },
      {
        isPersistenceReady: () => false,
        requireUser: async () => makeUser()
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(String(payload.message)).toContain("正式任务数据库");
  });

  it("returns 502 with readable message when model analysis is incomplete after retry", async () => {
    saveTaskSummary({
      id: "task-7",
      userId: "user-1",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: ""
    });

    const formData = new FormData();
    formData.append(
      "files",
      new File(["Assignment brief text."], "assignment.txt", {
        type: "text/plain"
      })
    );

    const response = await handleTaskFileUploadRequest(
      new Request("http://localhost/api/tasks/task-7/files", {
        method: "POST",
        body: formData
      }),
      {
        taskId: "task-7"
      },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        analyzeTask: async () => {
          throw new Error("MODEL_ANALYSIS_INCOMPLETE_AFTER_RETRY");
        }
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(String(payload.message)).toContain("模型");
    expect(String(payload.message)).toContain("重试");
    expect(String(payload.message)).not.toContain("MODEL_ANALYSIS_INCOMPLETE");
    expect(getTaskSummary("task-7")?.analysisStatus).toBe("failed");
  });
});

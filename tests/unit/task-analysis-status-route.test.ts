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
      analysisStatus: "pending"
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
        chineseMirror: null,
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
    expect(payload.outline.articleTitle).toBe("ASEAN Governance Risk");
    expect(payload.ruleCard.targetWordCount).toBe(2500);
    expect(payload.classification.primaryRequirementFileId).toBe("file-1");
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
    expect(String(payload.message)).toContain("返回内容不完整");
    expect(String(payload.message)).not.toContain("MODEL_ANALYSIS_INCOMPLETE");
  });
});

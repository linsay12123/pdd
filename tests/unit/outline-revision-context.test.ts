import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { reviseOutlineFromFilesWithOpenAIMock, listTaskFilesForModelMock } = vi.hoisted(() => ({
  reviseOutlineFromFilesWithOpenAIMock: vi.fn(),
  listTaskFilesForModelMock: vi.fn()
}));

vi.mock("../../src/lib/ai/services/revise-outline-from-files", () => ({
  reviseOutlineFromFilesWithOpenAI: reviseOutlineFromFilesWithOpenAIMock
}));

vi.mock("../../src/lib/tasks/save-task-files", async () => {
  const actual = await vi.importActual("../../src/lib/tasks/save-task-files");

  return {
    ...actual,
    listTaskFilesForModel: listTaskFilesForModelMock
  };
});

import {
  resetTaskOutlineStore,
  resetTaskStore,
  saveTaskSummary
} from "../../src/lib/tasks/repository";
import {
  reviseOutlineVersion,
  saveOutlineVersion
} from "../../src/lib/tasks/save-outline-version";

describe("outline revision context", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    resetTaskStore();
    resetTaskOutlineStore();
    reviseOutlineFromFilesWithOpenAIMock.mockReset();
    listTaskFilesForModelMock.mockReset();
  });

  it("sends the previous outline and raw user feedback into GPT outline revision", async () => {
    const previousOutline = {
      articleTitle: "Corporate Governance in ASEAN",
      targetWordCount: 2200,
      citationStyle: "APA 7",
      chineseMirrorPending: false,
      chineseMirror: null,
      sections: [
        {
          title: "Introduction",
          summary: "Set up the governance problem and essay scope.",
          bulletPoints: ["Scope", "Context", "Research focus"]
        },
        {
          title: "Governance Drivers",
          summary: "Explain the main drivers behind governance reform.",
          bulletPoints: ["Regulation", "Ownership", "Disclosure"]
        }
      ]
    };

    saveTaskSummary({
      id: "task-outline-feedback-1",
      userId: "user-1",
      status: "awaiting_outline_approval",
      targetWordCount: 2200,
      citationStyle: "APA 7",
      specialRequirements: "Focus on listed banks in Southeast Asia.",
      topic: "Corporate Governance in ASEAN",
      outlineRevisionCount: 0,
      analysisSnapshot: {
        chosenTaskFileId: "file-1",
        supportingFileIds: ["file-2"],
        ignoredFileIds: [],
        needsUserConfirmation: false,
        reasoning: "The task brief clearly defines the assignment.",
        targetWordCount: 2200,
        citationStyle: "APA 7",
        topic: "Corporate Governance in ASEAN",
        chapterCount: 4,
        mustCover: ["Board oversight"],
        gradingFocus: ["Critical analysis"],
        appliedSpecialRequirements: "Focus on listed banks in Southeast Asia.",
        usedDefaultWordCount: false,
        usedDefaultCitationStyle: false,
        warnings: []
      }
    });

    await saveOutlineVersion({
      task: {
        id: "task-outline-feedback-1",
        userId: "user-1",
        status: "awaiting_outline_approval",
        targetWordCount: 2200,
        citationStyle: "APA 7",
        specialRequirements: "Focus on listed banks in Southeast Asia.",
        topic: "Corporate Governance in ASEAN",
        outlineRevisionCount: 0,
        analysisSnapshot: {
          chosenTaskFileId: "file-1",
          supportingFileIds: ["file-2"],
          ignoredFileIds: [],
          needsUserConfirmation: false,
          reasoning: "The task brief clearly defines the assignment.",
          targetWordCount: 2200,
          citationStyle: "APA 7",
          topic: "Corporate Governance in ASEAN",
          chapterCount: 4,
          mustCover: ["Board oversight"],
          gradingFocus: ["Critical analysis"],
          appliedSpecialRequirements: "Focus on listed banks in Southeast Asia.",
          usedDefaultWordCount: false,
          usedDefaultCitationStyle: false,
          warnings: []
        }
      },
      userId: "user-1",
      outline: previousOutline
    });

    listTaskFilesForModelMock.mockResolvedValue([
      {
        id: "file-1",
        taskId: "task-outline-feedback-1",
        userId: "user-1",
        originalFilename: "assignment.txt",
        storagePath: "users/user-1/tasks/task-outline-feedback-1/uploads/assignment.txt",
        extractedText: "Assignment brief about corporate governance in ASEAN.",
        role: "requirement",
        isPrimary: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        rawBody: Buffer.from("Assignment brief about corporate governance in ASEAN.")
      }
    ]);
    reviseOutlineFromFilesWithOpenAIMock.mockResolvedValue({
      ...previousOutline,
      sections: previousOutline.sections.slice(0, 1)
    });

    await reviseOutlineVersion({
      taskId: "task-outline-feedback-1",
      userId: "user-1",
      feedback: "写三个章节，每个章节写具体分析点"
    });

    expect(reviseOutlineFromFilesWithOpenAIMock).toHaveBeenCalledTimes(1);
    expect(reviseOutlineFromFilesWithOpenAIMock).toHaveBeenCalledWith(
      expect.objectContaining({
        feedback: "写三个章节，每个章节写具体分析点",
        previousOutline,
        analysis: expect.objectContaining({
          topic: "Corporate Governance in ASEAN"
        })
      })
    );
    expect(reviseOutlineFromFilesWithOpenAIMock.mock.calls[0]?.[0]).not.toHaveProperty(
      "shorterOutline"
    );
  });
});

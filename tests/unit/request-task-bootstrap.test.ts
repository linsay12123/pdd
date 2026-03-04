import { describe, expect, it, vi } from "vitest";
import { requestTaskBootstrap } from "../../src/lib/tasks/request-task-bootstrap";
import { requestConfirmPrimaryFile } from "../../src/lib/tasks/request-confirm-primary-file";
import { requestOutlineApproval } from "../../src/lib/tasks/request-outline-approval";
import { requestOutlineFeedback } from "../../src/lib/tasks/request-outline-feedback";

describe("task bootstrap requests", () => {
  it("creates the task first, then uploads the selected files", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          task: {
            id: "task-1",
            status: "created",
            targetWordCount: null,
            citationStyle: null,
            specialRequirements: "Focus on finance."
          },
          frozenQuota: 0,
          message: "任务已创建"
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          task: {
            id: "task-1",
            status: "awaiting_outline_approval",
            targetWordCount: 1800,
            citationStyle: "Harvard",
            specialRequirements: "Focus on finance."
          },
          files: [
            {
              id: "file-1",
              originalFilename: "assignment.txt",
              role: "requirement",
              isPrimary: true
            }
          ],
          classification: {
            primaryRequirementFileId: "file-1",
            needsUserConfirmation: false
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
            warnings: []
          },
          ruleCard: {
            topic: "Finance Risk Management",
            targetWordCount: 1800,
            citationStyle: "Harvard",
            chapterCountOverride: null,
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
          message: "大纲已生成"
        })
      });

    const result = await requestTaskBootstrap({
      specialRequirements: "Focus on finance.",
      files: [
        new File(["Assignment brief"], "assignment.txt", { type: "text/plain" })
      ],
      fetchImpl: fetchSpy as typeof fetch
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[0][0]).toBe("/api/tasks/create");
    expect(fetchSpy.mock.calls[1][0]).toBe("/api/tasks/task-1/files");
    expect(fetchSpy.mock.calls[1][1]?.method).toBe("POST");
    expect(fetchSpy.mock.calls[1][1]?.body).toBeInstanceOf(FormData);

    const uploadBody = fetchSpy.mock.calls[1][1]?.body as FormData;
    const uploadedFiles = uploadBody.getAll("files") as File[];

    expect(uploadedFiles).toHaveLength(1);
    expect(uploadedFiles[0]?.name).toBe("assignment.txt");
    expect(result.frozenQuota).toBe(0);
    expect(result.task.status).toBe("awaiting_outline_approval");
    expect(result.analysis?.targetWordCount).toBe(1800);
    expect(result.analysis?.usedDefaultWordCount).toBe(false);
    expect(result.outline?.citationStyle).toBe("Harvard");
    expect(result.outline?.sections.length).toBeGreaterThan(0);
  });

  it("calls cancel to release quota when the upload fails, then rethrows", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          task: {
            id: "task-2",
            status: "created",
            targetWordCount: null,
            citationStyle: null,
            specialRequirements: ""
          },
          frozenQuota: 0,
          message: "任务已创建"
        })
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          message: "上传文件失败"
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          releasedQuota: 500,
          message: "任务已取消，积分已返还。"
        })
      });

    await expect(
      requestTaskBootstrap({
        specialRequirements: "",
        files: [new File(["Assignment brief"], "assignment.txt", { type: "text/plain" })],
        fetchImpl: fetchSpy as typeof fetch
      })
    ).rejects.toThrow("上传文件失败");

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(fetchSpy.mock.calls[2][0]).toBe("/api/tasks/task-2/cancel");
    expect(fetchSpy.mock.calls[2][1]?.method).toBe("POST");
  });

  it("submits the selected primary file back to the confirmation route", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        task: {
          id: "task-3",
          status: "awaiting_outline_approval",
          targetWordCount: 2000,
          citationStyle: "Harvard",
          specialRequirements: ""
        },
        files: [],
        classification: {
          primaryRequirementFileId: "file-2",
          backgroundFileIds: [],
          irrelevantFileIds: [],
          needsUserConfirmation: false,
          reasoning: "GPT selected the requirement file."
        },
        analysis: {
          chosenTaskFileId: "file-2",
          supportingFileIds: [],
          ignoredFileIds: [],
          needsUserConfirmation: false,
          reasoning: "The confirmed file contains the explicit assignment constraints.",
          targetWordCount: 2000,
          citationStyle: "Harvard",
          topic: "Corporate Governance",
          chapterCount: 4,
          mustCover: ["Board oversight"],
          gradingFocus: ["Critical evaluation"],
          appliedSpecialRequirements: "",
          usedDefaultWordCount: false,
          usedDefaultCitationStyle: false,
          warnings: []
        },
        ruleCard: {
          topic: "Corporate Governance",
          targetWordCount: 2000,
          citationStyle: "Harvard",
          chapterCountOverride: null,
          mustAnswer: ["Board oversight"],
          gradingPriorities: ["Critical evaluation"],
          specialRequirements: ""
        },
        outline: {
          articleTitle: "Corporate Governance and Board Oversight",
          targetWordCount: 2000,
          citationStyle: "Harvard",
          chineseMirrorPending: true,
          sections: [
            {
              title: "Introduction",
              summary: "Set up the board oversight issue and essay argument.",
              bulletPoints: ["Explain the context", "State the problem", "Define the argument"]
            }
          ]
        },
        primaryRequirementFileId: "file-2",
        message: "主任务文件已确认"
      })
    });

    const result = await requestConfirmPrimaryFile({
      taskId: "task-3",
      fileId: "file-2",
      fetchImpl: fetchSpy as typeof fetch
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe(
      "/api/tasks/task-3/files/confirm-primary"
    );
    expect(fetchSpy.mock.calls[0][1]?.method).toBe("POST");
    expect(result.primaryRequirementFileId).toBe("file-2");
    expect(result.classification.primaryRequirementFileId).toBe("file-2");
    expect(result.classification.needsUserConfirmation).toBe(false);
    expect(result.analysis?.topic).toBe("Corporate Governance");
    expect(result.ruleCard).not.toBeNull();
    expect(result.ruleCard?.citationStyle).toBe("Harvard");
  });

  it("sends outline feedback to the server and returns the new version", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        task: {
          id: "task-4",
          status: "awaiting_outline_approval",
          targetWordCount: 2000,
          citationStyle: "APA 7",
          specialRequirements: ""
        },
        outlineVersion: {
          id: "outline-2",
          versionNumber: 2
        },
        outline: {
          articleTitle: "Corporate Governance and Board Oversight",
          targetWordCount: 2000,
          citationStyle: "APA 7",
          chineseMirrorPending: true,
          sections: [
            {
              title: "Introduction",
              summary: "Set up the governance problem and explain the revised focus.",
              bulletPoints: ["State the focus", "Explain the revision", "Set up the analysis"]
            }
          ]
        },
        message: "已生成新一版大纲"
      })
    });

    const result = await requestOutlineFeedback({
      taskId: "task-4",
      feedback: "Shorter please.",
      fetchImpl: fetchSpy as typeof fetch
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe("/api/tasks/task-4/outline/feedback");
    expect(fetchSpy.mock.calls[0][1]?.method).toBe("POST");
    expect(result.outlineVersion.versionNumber).toBe(2);
  });

  it("approves the latest outline without requiring the page to know internal ids", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        task: {
          id: "task-5",
          status: "drafting",
          targetWordCount: 2000,
          citationStyle: "APA 7",
          specialRequirements: ""
        },
        outlineVersion: {
          id: "outline-3",
          isApproved: true
        },
        message: "大纲已确认"
      })
    });

    const result = await requestOutlineApproval({
      taskId: "task-5",
      fetchImpl: fetchSpy as typeof fetch
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe("/api/tasks/task-5/outline/approve");
    expect(fetchSpy.mock.calls[0][1]?.method).toBe("POST");
    expect(result.outlineVersion.isApproved).toBe(true);
    expect(result.task.status).toBe("drafting");
  });
});

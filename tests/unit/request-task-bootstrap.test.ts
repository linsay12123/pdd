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
            status: "quota_frozen",
            targetWordCount: 2000,
            citationStyle: "APA 7",
            specialRequirements: "Focus on finance."
          },
          frozenQuota: 500,
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
          ruleCard: {
            topic: "General Academic Essay",
            targetWordCount: 1800,
            citationStyle: "Harvard",
            chapterCountOverride: null,
            mustAnswer: [],
            gradingPriorities: [],
            specialRequirements: "Focus on finance."
          },
          outline: {
            articleTitle: "General Academic Essay: A Structured Analysis",
            targetWordCount: 1800,
            citationStyle: "Harvard",
            chineseMirrorPending: true,
            sections: []
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
    expect(result.frozenQuota).toBe(500);
    expect(result.task.status).toBe("awaiting_outline_approval");
    expect(result.outline?.citationStyle).toBe("Harvard");
  });

  it("calls cancel to release quota when the upload fails, then rethrows", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          task: {
            id: "task-2",
            status: "quota_frozen",
            targetWordCount: 2000,
            citationStyle: "APA 7",
            specialRequirements: ""
          },
          frozenQuota: 500,
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
        ruleCard: {
          topic: "General Academic Essay",
          targetWordCount: 2000,
          citationStyle: "Harvard",
          chapterCountOverride: null,
          mustAnswer: [],
          gradingPriorities: [],
          specialRequirements: ""
        },
        outline: {
          articleTitle: "General Academic Essay: A Structured Analysis",
          targetWordCount: 2000,
          citationStyle: "Harvard",
          chineseMirrorPending: true,
          sections: []
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
          articleTitle: "General Academic Essay: A Structured Analysis",
          targetWordCount: 2000,
          citationStyle: "APA 7",
          chineseMirrorPending: true,
          sections: []
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

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { handleOutlineFeedbackRequest } from "../../app/api/tasks/[taskId]/outline/feedback/route";

describe("outline feedback route", () => {
  it("returns 503 when the official task persistence pipeline is unavailable", async () => {
    const response = await handleOutlineFeedbackRequest(
      new Request("http://localhost/api/tasks/task-1/outline/feedback", {
        method: "POST",
        body: JSON.stringify({
          feedback: "写三个章节"
        }),
        headers: {
          "content-type": "application/json"
        }
      }),
      {
        taskId: "task-1"
      },
      {
        isPersistenceReady: () => false,
        requireUser: async () => ({
          id: "11111111-1111-4111-8111-111111111111",
          email: "user@example.com",
          role: "user"
        })
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.message).toContain("正式任务数据库");
  });

  it("uses the real revision path dependency instead of any local fallback", async () => {
    const response = await handleOutlineFeedbackRequest(
      new Request("http://localhost/api/tasks/task-1/outline/feedback", {
        method: "POST",
        body: JSON.stringify({
          feedback: "写三个章节"
        }),
        headers: {
          "content-type": "application/json"
        }
      }),
      {
        taskId: "task-1"
      },
      {
        isPersistenceReady: () => true,
        requireUser: async () => ({
          id: "11111111-1111-4111-8111-111111111111",
          email: "user@example.com",
          role: "user"
        }),
        reviseOutline: async ({ taskId, userId, feedback }) => ({
          task: {
            id: taskId,
            userId,
            status: "awaiting_outline_approval",
            targetWordCount: 1500,
            citationStyle: "APA 7",
            specialRequirements: "",
            outlineRevisionCount: 1,
            latestOutlineVersionId: "outline-2"
          },
          outlineVersion: {
            id: "outline-2",
            taskId,
            userId,
            versionNumber: 2,
            feedback,
            isApproved: false,
            targetWordCount: 1500,
            citationStyle: "APA 7",
            createdAt: "2026-03-04T10:00:00.000Z",
            outline: {
              articleTitle: "Corporate Governance in ASEAN Banks",
              targetWordCount: 1500,
              citationStyle: "APA 7",
              chineseMirrorPending: true,
              sections: [
                {
                  title: "Introduction",
                  summary: "Frame the argument.",
                  bulletPoints: ["Context", "Problem", "Argument"]
                },
                {
                  title: "Evidence",
                  summary: "Develop the evidence.",
                  bulletPoints: ["Sources", "Analysis", "Implications"]
                },
                {
                  title: "Conclusion",
                  summary: "Conclude the essay.",
                  bulletPoints: ["Findings", "Implications", "Close"]
                }
              ]
            }
          }
        })
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.outline.sections).toHaveLength(3);
    expect(payload.message).toContain("新一版大纲");
  });
});

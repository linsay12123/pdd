import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { handleTaskWorkflowStreamRequest } from "../../app/api/tasks/[taskId]/workflow/stream/route";

function makeUser() {
  return {
    id: "user-1",
    email: "user-1@example.com",
    role: "user" as const
  };
}

describe("task workflow stream route", () => {
  it("streams the current workflow snapshot immediately", async () => {
    const response = await handleTaskWorkflowStreamRequest(
      new Request("http://localhost/api/tasks/task-stream-1/workflow/stream"),
      { taskId: "task-stream-1" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        getWorkflowSnapshot: async () => ({
          ok: true,
          task: {
            id: "task-stream-1",
            status: "adjusting_word_count",
            targetWordCount: 1000,
            citationStyle: "Harvard",
            specialRequirements: "",
            lastWorkflowStage: "adjusting_word_count",
            workflowStageTimestamps: {
              drafting: "2026-03-09T10:00:00.000Z",
              adjusting_word_count: "2026-03-09T10:02:00.000Z"
            }
          },
          downloads: {
            finalDocxOutputId: null,
            referenceReportOutputId: null,
            humanizedDocxOutputId: null
          },
          finalWordCount: null,
          message: "系统正在把正文部分校正到目标字数的正负 10 以内。"
        })
      }
    );

    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const reader = response.body?.getReader();
    expect(reader).toBeTruthy();

    const firstChunk = await reader!.read();
    const text = new TextDecoder().decode(firstChunk.value);

    expect(text).toContain("event: workflow");
    expect(text).toContain("\"status\":\"adjusting_word_count\"");
    expect(text).toContain("\"workflowStageTimestamps\":{\"drafting\":\"2026-03-09T10:00:00.000Z\",\"adjusting_word_count\":\"2026-03-09T10:02:00.000Z\"}");

    await reader!.cancel();
  });
});

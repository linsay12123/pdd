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

describe("task file routes", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    resetTaskStore();
    resetTaskFileStore();
  });

  it("persists uploaded files and auto-selects one clear requirement file", async () => {
    saveTaskSummary({
      id: "task-1",
      userId: "user-1",
      status: "quota_frozen",
      targetWordCount: 2000,
      citationStyle: "APA 7",
      specialRequirements: ""
    });

    const formData = new FormData();
    formData.append(
      "files",
      new File(
        [
          "Assignment brief. Required word count: 1800 words. Citation style: Harvard. Answer the following questions."
        ],
        "assignment.txt",
        { type: "text/plain" }
      )
    );
    formData.append(
      "files",
      new File(
        ["Background reading about the industry and market context."],
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
        requireUser: async () => ({
          id: "user-1",
          email: "user-1@example.com",
          role: "user"
        })
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.classification.primaryRequirementFileId).toBeTruthy();
    expect(payload.classification.needsUserConfirmation).toBe(false);
    expect(payload.task.status).toBe("awaiting_outline_approval");
    expect(payload.task.targetWordCount).toBe(1800);
    expect(payload.task.citationStyle).toBe("Harvard");
    expect(payload.ruleCard.targetWordCount).toBe(1800);
    expect(payload.ruleCard.citationStyle).toBe("Harvard");
    expect(payload.outline.articleTitle).toContain("General Academic Essay");
    expect(payload.outline.sections).toHaveLength(4);

    const files = listTaskFiles("task-1");
    expect(files).toHaveLength(2);
    expect(files.find((file) => file.isPrimary)?.role).toBe("requirement");
    expect(files.find((file) => !file.isPrimary)?.role).toBe("background");
    expect(getTaskSummary("task-1")?.primaryRequirementFileId).toBe(
      payload.classification.primaryRequirementFileId
    );
    expect(getTaskSummary("task-1")?.targetWordCount).toBe(1800);
  });

  it("asks the user to confirm when two files both look like task briefs", async () => {
    saveTaskSummary({
      id: "task-2",
      userId: "user-1",
      status: "quota_frozen",
      targetWordCount: 2000,
      citationStyle: "APA 7",
      specialRequirements: ""
    });

    const formData = new FormData();
    formData.append(
      "files",
      new File(
        ["Assignment brief. Required word count: 1800 words. Use APA 7."],
        "assignment-a.txt",
        { type: "text/plain" }
      )
    );
    formData.append(
      "files",
      new File(
        ["Assessment requirements. Write 2000 words. Citation style: Harvard."],
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
        requireUser: async () => ({
          id: "user-1",
          email: "user-1@example.com",
          role: "user"
        })
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.classification.primaryRequirementFileId).toBe(null);
    expect(payload.classification.needsUserConfirmation).toBe(true);
    expect(payload.task.status).toBe("awaiting_primary_file_confirmation");
    expect(payload.ruleCard).toBe(null);
    expect(payload.outline).toBe(null);
  });

  it("lets the signed-in user confirm the primary file and move the task forward", async () => {
    saveTaskSummary({
      id: "task-3",
      userId: "user-1",
      status: "awaiting_primary_file_confirmation",
      targetWordCount: 2000,
      citationStyle: "APA 7",
      specialRequirements: ""
    });

    const formData = new FormData();
    formData.append(
      "files",
      new File(
        ["Assignment brief. Required word count: 1800 words. Use APA 7."],
        "assignment-a.txt",
        { type: "text/plain" }
      )
    );
    formData.append(
      "files",
      new File(
        ["Assessment requirements. Write 2000 words. Citation style: Harvard."],
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
        requireUser: async () => ({
          id: "user-1",
          email: "user-1@example.com",
          role: "user"
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
        requireUser: async () => ({
          id: "user-1",
          email: "user-1@example.com",
          role: "user"
        })
      }
    );
    const confirmPayload = await confirmResponse.json();

    expect(confirmResponse.status).toBe(200);
    expect(confirmPayload.task.status).toBe("awaiting_outline_approval");
    expect(confirmPayload.primaryRequirementFileId).toBe(selectedFileId);
    expect(confirmPayload.ruleCard.targetWordCount).toBe(2000);
    expect(confirmPayload.ruleCard.citationStyle).toBe("Harvard");
    expect(confirmPayload.outline.sections).toHaveLength(4);

    const files = listTaskFiles("task-3");
    expect(files.find((file) => file.id === selectedFileId)?.isPrimary).toBe(true);
    expect(files.find((file) => file.id === selectedFileId)?.role).toBe("requirement");
    expect(getTaskSummary("task-3")?.primaryRequirementFileId).toBe(selectedFileId);
    expect(getTaskSummary("task-3")?.citationStyle).toBe("Harvard");
  });
});

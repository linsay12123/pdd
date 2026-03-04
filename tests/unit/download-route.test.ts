import { beforeEach, describe, expect, it } from "vitest";
import {
  handleTaskDownloadRequest
} from "../../app/api/tasks/[taskId]/downloads/[outputId]/route";
import {
  resetTaskOutputStore,
  saveTaskOutputRecord
} from "../../src/lib/tasks/repository";

describe("task download route", () => {
  beforeEach(() => {
    resetTaskOutputStore();
  });

  it("requires a signed-in user before creating a download link", async () => {
    const response = await handleTaskDownloadRequest(
      new Request("http://localhost/api/tasks/task-1/downloads/out-1"),
      {
        taskId: "task-1",
        outputId: "out-1"
      },
      {
        isPersistenceReady: () => true,
        requireUser: async () => {
          throw new Error("AUTH_REQUIRED");
        }
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.message).toContain("登录");
  });

  it("uses the current session user instead of a query user id", async () => {
    saveTaskOutputRecord({
      id: "out-1",
      taskId: "task-1",
      userId: "user-1",
      outputKind: "final_docx",
      storagePath: "users/user-1/tasks/task-1/output/final.docx"
    });

    const response = await handleTaskDownloadRequest(
      new Request("http://localhost/api/tasks/task-1/downloads/out-1?userId=evil-user"),
      {
        taskId: "task-1",
        outputId: "out-1"
      },
      {
        isPersistenceReady: () => true,
        requireUser: async () => ({
          id: "user-1",
          email: "user1@example.com",
          role: "user"
        })
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.signedUrl).toContain("final.docx");
  });

  it("returns 503 when the official task output database path is unavailable", async () => {
    const response = await handleTaskDownloadRequest(
      new Request("http://localhost/api/tasks/task-1/downloads/out-1"),
      {
        taskId: "task-1",
        outputId: "out-1"
      },
      {
        isPersistenceReady: () => false,
        requireUser: async () => ({
          id: "user-1",
          email: "user1@example.com",
          role: "user"
        })
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.message).toContain("正式任务数据库");
  });
});

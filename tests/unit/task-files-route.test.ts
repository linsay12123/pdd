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

describe("task file async analysis routes", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    process.env.TRIGGER_SECRET_KEY = "trigger-secret";
    process.env.VERCEL_ENV = "preview";
    resetTaskStore();
    resetTaskFileStore();
  });

  it("blocks production upload when TRIGGER_SECRET_KEY uses dev prefix", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.TRIGGER_SECRET_KEY = "tr_dev_example";

    saveTaskSummary({
      id: "task-dev-key",
      userId: "user-1",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: ""
    });

    const formData = new FormData();
    formData.append(
      "files",
      new File(["Assignment brief text."], "assignment.txt", { type: "text/plain" })
    );

    const response = await handleTaskFileUploadRequest(
      new Request("http://localhost/api/tasks/task-dev-key/files", {
        method: "POST",
        body: formData
      }),
      { taskId: "task-dev-key" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        enqueueTaskAnalysis: async () => null
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(String(payload.message)).toContain("生产环境");
    expect(String(payload.message)).toContain("tr_live");
  });

  it("accepts upload with 202 and queues background analysis instead of blocking synchronously", async () => {
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
      new File(["Assignment brief text."], "assignment.txt", { type: "text/plain" })
    );

    const enqueueTaskAnalysis = vi.fn(async () => "run-upload-task-1");
    const response = await handleTaskFileUploadRequest(
      new Request("http://localhost/api/tasks/task-1/files", {
        method: "POST",
        body: formData
      }),
      { taskId: "task-1" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        enqueueTaskAnalysis
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload.ok).toBe(true);
    expect(payload.analysisStatus).toBe("pending");
    expect(payload.outline).toBeNull();
    expect(payload.analysis).toBeNull();
    expect(enqueueTaskAnalysis).toHaveBeenCalledTimes(1);
    expect(enqueueTaskAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "task-1",
        userId: "user-1"
      })
    );
    expect(getTaskSummary("task-1")?.analysisStatus).toBe("pending");
    expect(listTaskFiles("task-1")).toHaveLength(1);
  });

  it("returns 502 and marks analysis failed when queue submission fails", async () => {
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
      new File(["Assignment brief text."], "assignment.txt", { type: "text/plain" })
    );

    const response = await handleTaskFileUploadRequest(
      new Request("http://localhost/api/tasks/task-2/files", {
        method: "POST",
        body: formData
      }),
      { taskId: "task-2" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        enqueueTaskAnalysis: async () => {
          throw new Error("trigger queue unavailable");
        }
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(String(payload.message)).toContain("后台分析任务启动失败");
    expect(getTaskSummary("task-2")?.analysisStatus).toBe("failed");
  });

  it("keeps pdf transport-only strategy while still queueing async analysis", async () => {
    saveTaskSummary({
      id: "task-3",
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
      new Request("http://localhost/api/tasks/task-3/files", {
        method: "POST",
        body: formData
      }),
      { taskId: "task-3" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        enqueueTaskAnalysis: async () => "run-upload-task-3"
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload.files[0].extractionMethod).toBe("transport_only_pdf");
  });

  it("accepts confirmed primary file and queues re-analysis with forcedPrimaryFileId", async () => {
    saveTaskSummary({
      id: "task-4",
      userId: "user-1",
      status: "awaiting_primary_file_confirmation",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: ""
    });

    const formData = new FormData();
    formData.append(
      "files",
      new File(["A brief"], "brief-a.txt", { type: "text/plain" })
    );
    formData.append(
      "files",
      new File(["B brief"], "brief-b.txt", { type: "text/plain" })
    );

    await handleTaskFileUploadRequest(
      new Request("http://localhost/api/tasks/task-4/files", {
        method: "POST",
        body: formData
      }),
      { taskId: "task-4" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        enqueueTaskAnalysis: async () => "run-upload-task-4"
      }
    );

    const files = listTaskFiles("task-4");
    const chosenFileId = files[1]?.id;
    expect(chosenFileId).toBeTruthy();

    const enqueueTaskAnalysis = vi.fn(async () => "run-confirm-primary-task-4");
    const response = await handleConfirmPrimaryFileRequest(
      new Request("http://localhost/api/tasks/task-4/files/confirm-primary", {
        method: "POST",
        body: JSON.stringify({ fileId: chosenFileId }),
        headers: {
          "content-type": "application/json"
        }
      }),
      { taskId: "task-4" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        enqueueTaskAnalysis
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload.analysisStatus).toBe("pending");
    expect(payload.primaryRequirementFileId).toBe(chosenFileId);
    expect(enqueueTaskAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "task-4",
        userId: "user-1",
        forcedPrimaryFileId: chosenFileId
      })
    );
    expect(getTaskSummary("task-4")?.analysisStatus).toBe("pending");
    expect(getTaskSummary("task-4")?.primaryRequirementFileId).toBe(chosenFileId);
  });

  it("returns 502 when trigger does not return run id", async () => {
    saveTaskSummary({
      id: "task-missing-run-id",
      userId: "user-1",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: ""
    });

    const formData = new FormData();
    formData.append(
      "files",
      new File(["Assignment brief text."], "assignment.txt", { type: "text/plain" })
    );

    const response = await handleTaskFileUploadRequest(
      new Request("http://localhost/api/tasks/task-missing-run-id/files", {
        method: "POST",
        body: formData
      }),
      { taskId: "task-missing-run-id" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        enqueueTaskAnalysis: async () => null
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(String(payload.message)).toContain("后台分析任务启动失败");
    expect(getTaskSummary("task-missing-run-id")?.analysisStatus).toBe("failed");
  });
});

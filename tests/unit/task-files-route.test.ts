import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { handleTaskFileUploadRequest } from "../../app/api/tasks/[taskId]/files/route";
import { handleConfirmPrimaryFileRequest } from "../../app/api/tasks/[taskId]/files/confirm-primary/route";
import {
  getTaskSummary,
  listTaskFiles,
  resetTaskFileStore,
  resetTaskStore,
  saveTaskFileRecords,
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
    expect(String(payload.message)).toContain("tr_prod");
  });

  it("rejects files that exceed the configured upload size limit", async () => {
    saveTaskSummary({
      id: "task-too-large",
      userId: "user-1",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: ""
    });

    const formData = new FormData();
    formData.append(
      "files",
      new File(["abcde"], "assignment.txt", { type: "text/plain" })
    );

    const response = await handleTaskFileUploadRequest(
      new Request("http://localhost/api/tasks/task-too-large/files", {
        method: "POST",
        body: formData
      }),
      { taskId: "task-too-large" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        maxFileBytes: 4
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(String(payload.message)).toContain("超过");
    expect(getTaskSummary("task-too-large")?.analysisStatus).not.toBe("pending");
  });

  it("rejects uploads when file count exceeds the configured limit", async () => {
    saveTaskSummary({
      id: "task-too-many",
      userId: "user-1",
      status: "created",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: ""
    });

    const formData = new FormData();
    formData.append("files", new File(["a"], "a.txt", { type: "text/plain" }));
    formData.append("files", new File(["b"], "b.txt", { type: "text/plain" }));

    const response = await handleTaskFileUploadRequest(
      new Request("http://localhost/api/tasks/task-too-many/files", {
        method: "POST",
        body: formData
      }),
      { taskId: "task-too-many" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        maxFileCount: 1
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(String(payload.message)).toContain("最多");
    expect(getTaskSummary("task-too-many")?.analysisStatus).not.toBe("pending");
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
        enqueueTaskAnalysis,
        getTriggerRunState: async () => ({ state: "active", status: "QUEUED" }),
        startupProbeAttempts: 1
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

  it("accepts a fresh upload when startup confirmation is still pending_version", async () => {
    saveTaskSummary({
      id: "task-upload-starting",
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

    const enqueueTaskAnalysis = vi.fn().mockResolvedValueOnce("run-upload-pending-version-0");
    const getTriggerRunState = vi
      .fn()
      .mockResolvedValueOnce({ state: "pending_version", status: "PENDING_VERSION" });

    const response = await handleTaskFileUploadRequest(
      new Request("http://localhost/api/tasks/task-upload-starting/files", {
        method: "POST",
        body: formData
      }),
      { taskId: "task-upload-starting" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        enqueueTaskAnalysis,
        getTriggerRunState
      } as never
    );
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(String(payload.message)).toContain("系统正在后台分析");
    expect(enqueueTaskAnalysis).toHaveBeenCalledTimes(1);
    expect(getTriggerRunState).toHaveBeenCalledTimes(1);
    expect(getTaskSummary("task-upload-starting")?.analysisStatus).toBe("pending");
    expect(getTaskSummary("task-upload-starting")?.analysisErrorMessage).toBeNull();
  });

  it("treats pending_version as accepted startup instead of forcing a second probe", async () => {
    saveTaskSummary({
      id: "task-upload-waits-for-active",
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

    const enqueueTaskAnalysis = vi.fn().mockResolvedValueOnce("run-upload-waits-for-active-0");
    const getTriggerRunState = vi
      .fn()
      .mockResolvedValueOnce({ state: "pending_version", status: "PENDING_VERSION" })
      .mockResolvedValueOnce({ state: "active", status: "QUEUED" });

    const response = await handleTaskFileUploadRequest(
      new Request("http://localhost/api/tasks/task-upload-waits-for-active/files", {
        method: "POST",
        body: formData
      }),
      { taskId: "task-upload-waits-for-active" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        enqueueTaskAnalysis,
        getTriggerRunState,
        startupProbeAttempts: 2
      } as never
    );
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload.analysisStatus).toBe("pending");
    expect(payload.analysisRuntime.runId).toBe("run-upload-waits-for-active-0");
    expect(enqueueTaskAnalysis).toHaveBeenCalledTimes(1);
    expect(getTriggerRunState).toHaveBeenCalledTimes(1);
    expect(getTaskSummary("task-upload-waits-for-active")?.analysisStatus).toBe("pending");
  });

  it("fails fast only when startup confirmation never sees an accepted runtime state", async () => {
    saveTaskSummary({
      id: "task-upload-runtime-bad",
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

    const enqueueTaskAnalysis = vi
      .fn()
      .mockResolvedValueOnce("run-upload-bad-0")
      .mockResolvedValueOnce("run-upload-bad-1");
    const getTriggerRunState = vi
      .fn()
      .mockResolvedValueOnce({ state: "unknown", status: null })
      .mockResolvedValueOnce({ state: "missing", status: null });

    const response = await handleTaskFileUploadRequest(
      new Request("http://localhost/api/tasks/task-upload-runtime-bad/files", {
        method: "POST",
        body: formData
      }),
      { taskId: "task-upload-runtime-bad" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        enqueueTaskAnalysis,
        getTriggerRunState,
        startupProbeAttempts: 1
      } as never
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(String(payload.message)).toContain("线上后台环境");
    expect(getTaskSummary("task-upload-runtime-bad")?.analysisStatus).toBe("failed");
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
        enqueueTaskAnalysis: async () => "run-upload-task-3",
        getTriggerRunState: async () => ({ state: "active", status: "QUEUED" }),
        startupProbeAttempts: 1
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
        enqueueTaskAnalysis: async () => "run-upload-task-4",
        getTriggerRunState: async () => ({ state: "active", status: "QUEUED" }),
        startupProbeAttempts: 1
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
        enqueueTaskAnalysis,
        getTriggerRunState: async () => ({ state: "active", status: "QUEUED" }),
        startupProbeAttempts: 1
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

  it("keeps confirm-primary pending when startup confirmation is still pending_version", async () => {
    saveTaskSummary({
      id: "task-confirm-starting",
      userId: "user-1",
      status: "awaiting_primary_file_confirmation",
      targetWordCount: null,
      citationStyle: null,
      specialRequirements: ""
    });

    saveTaskFileRecords([
      {
        id: "file-1",
        taskId: "task-confirm-starting",
        userId: "user-1",
        originalFilename: "brief-a.txt",
        storagePath: "tmp/brief-a.txt",
        extractedText: "A brief",
        role: "unknown",
        isPrimary: false
      }
    ]);

    const enqueueTaskAnalysis = vi
      .fn()
      .mockResolvedValueOnce("run-confirm-pending-version-0");
    const getTriggerRunState = vi
      .fn()
      .mockResolvedValueOnce({ state: "pending_version", status: "PENDING_VERSION" });

    const response = await handleConfirmPrimaryFileRequest(
      new Request("http://localhost/api/tasks/task-confirm-starting/files/confirm-primary", {
        method: "POST",
        body: JSON.stringify({ fileId: "file-1" }),
        headers: {
          "content-type": "application/json"
        }
      }),
      { taskId: "task-confirm-starting" },
      {
        isPersistenceReady: () => true,
        requireUser: async () => makeUser(),
        enqueueTaskAnalysis,
        getTriggerRunState
      } as never
    );
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(String(payload.message)).toContain("主任务文件已确认");
    expect(enqueueTaskAnalysis).toHaveBeenCalledTimes(1);
    expect(getTaskSummary("task-confirm-starting")?.analysisStatus).toBe("pending");
    expect(getTaskSummary("task-confirm-starting")?.analysisErrorMessage).toBeNull();
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

import { describe, expect, it, vi } from "vitest";
import { cleanupTaskArtifacts } from "../../src/lib/storage/cleanup-task-artifacts";

describe("cleanup task artifacts", () => {
  it("deletes storage first then removes db rows for outputs and uploads", async () => {
    const deleteStorageObject = vi.fn().mockResolvedValue({ ok: true });
    const deleteOutputRecord = vi.fn().mockResolvedValue(undefined);
    const deleteUploadRecord = vi.fn().mockResolvedValue(undefined);

    const result = await cleanupTaskArtifacts(
      {
        limit: 10,
        uploadRetentionDays: 3
      },
      {
        isPersistenceReady: () => true,
        listOutputCandidates: async () => [
          {
            id: "out-1",
            userId: "user-1",
            storagePath: "users/user-1/tasks/t-1/outputs/a.docx"
          }
        ],
        listUploadCandidates: async () => [
          {
            id: "file-1",
            userId: "user-1",
            taskId: "t-1",
            storagePath: "users/user-1/tasks/t-1/uploads/a.pdf"
          }
        ],
        deleteStorageObject,
        deleteOutputRecord,
        deleteUploadRecord
      }
    );

    expect(deleteStorageObject).toHaveBeenCalledTimes(2);
    expect(deleteOutputRecord).toHaveBeenCalledWith("out-1", "user-1");
    expect(deleteUploadRecord).toHaveBeenCalledWith("file-1", "user-1");
    expect(result.deletedOutputs).toBe(1);
    expect(result.deletedUploads).toBe(1);
    expect(result.failed).toBe(0);
  });

  it("does not delete db row when storage delete fails", async () => {
    const deleteStorageObject = vi.fn().mockResolvedValue({
      ok: false,
      reason: "storage unavailable"
    });
    const deleteOutputRecord = vi.fn();

    const result = await cleanupTaskArtifacts(
      {
        limit: 10,
        uploadRetentionDays: 3
      },
      {
        isPersistenceReady: () => true,
        listOutputCandidates: async () => [
          {
            id: "out-1",
            userId: "user-1",
            storagePath: "users/user-1/tasks/t-1/outputs/a.docx"
          }
        ],
        listUploadCandidates: async () => [],
        deleteStorageObject,
        deleteOutputRecord,
        deleteUploadRecord: vi.fn()
      }
    );

    expect(deleteOutputRecord).not.toHaveBeenCalled();
    expect(result.deletedOutputs).toBe(0);
    expect(result.failed).toBe(1);
  });

  it("skips cleanup when real persistence is disabled", async () => {
    const result = await cleanupTaskArtifacts(
      {
        limit: 10,
        uploadRetentionDays: 3
      },
      {
        isPersistenceReady: () => false
      }
    );

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("REAL_PERSISTENCE_REQUIRED");
  });
});

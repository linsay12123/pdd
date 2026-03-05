import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { handleStorageDownloadRequest } from "../../app/api/storage/download/route";
import { saveTaskOutputRecord, resetTaskOutputStore } from "../../src/lib/tasks/repository";
import { createSignedDownloadUrl } from "../../src/lib/storage/signed-url";
import { resolveStoredFileDiskPath } from "../../src/lib/storage/task-output-files";

describe("storage download route", () => {
  const ownerId = "user-storage-1";
  const outsiderId = "user-storage-2";

  beforeEach(async () => {
    resetTaskOutputStore();
    await rm(path.join(process.cwd(), "storage", "users", ownerId), {
      recursive: true,
      force: true
    });
    await rm(path.join(process.cwd(), "storage", "users", outsiderId), {
      recursive: true,
      force: true
    });
  });

  it("streams the stored file back to the same logged-in user", async () => {
    const output = saveTaskOutputRecord({
      id: "out-storage-1",
      taskId: "task-storage-1",
      userId: ownerId,
      outputKind: "final_docx",
      storagePath: `users/${ownerId}/tasks/task-storage-1/outputs/final.docx`,
      expiresAt: "2099-03-05T09:00:00.000Z"
    });
    const outputPath = resolveStoredFileDiskPath(output.storagePath);

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, "final-doc-placeholder", "utf8");

    const signedUrl = createSignedDownloadUrl({
      output,
      userId: ownerId
    });

    const response = await handleStorageDownloadRequest(
      new Request(`http://localhost${signedUrl}`),
      {
        requireUser: async () => ({
          id: ownerId,
          email: "user-1@example.com",
          role: "user"
        })
      }
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("final-doc-placeholder");
  });

  it("blocks the download when another user tries to use the same path", async () => {
    const output = saveTaskOutputRecord({
      id: "out-storage-2",
      taskId: "task-storage-2",
      userId: ownerId,
      outputKind: "final_docx",
      storagePath: `users/${ownerId}/tasks/task-storage-2/outputs/final.docx`,
      expiresAt: "2099-03-05T09:00:00.000Z"
    });

    const signedUrl = createSignedDownloadUrl({
      output,
      userId: ownerId
    });

    const response = await handleStorageDownloadRequest(
      new Request(`http://localhost${signedUrl}`),
      {
        requireUser: async () => ({
          id: outsiderId,
          email: "user-2@example.com",
          role: "user"
        })
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.message).toContain("无权");
  });

  it("rejects a download link when the signed URL itself has expired", async () => {
    const output = saveTaskOutputRecord({
      id: "out-storage-expired-link",
      taskId: "task-storage-expired-link",
      userId: ownerId,
      outputKind: "final_docx",
      storagePath: `users/${ownerId}/tasks/task-storage-expired-link/outputs/final.docx`,
      expiresAt: "2099-03-05T09:00:00.000Z"
    });
    const outputPath = resolveStoredFileDiskPath(output.storagePath);

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, "final-doc-placeholder", "utf8");

    const signedUrl = createSignedDownloadUrl({
      output,
      userId: ownerId
    });
    const expiredUrl = new URL(`http://localhost${signedUrl}`);
    expiredUrl.searchParams.set("expires", "2000-01-01T00:00:00.000Z");
    const expiredSignedUrl = `${expiredUrl.pathname}${expiredUrl.search}`;

    const response = await handleStorageDownloadRequest(
      new Request(`http://localhost${expiredSignedUrl}`),
      {
        requireUser: async () => ({
          id: ownerId,
          email: "owner@example.com",
          role: "user"
        })
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(String(payload.message)).toContain("过期");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  expireTaskOutputs,
  getTaskOutputs,
  resetTaskOutputStore,
  saveTaskOutputRecord
} from "../../src/lib/tasks/repository";
import { createSignedDownloadUrl } from "../../src/lib/storage/signed-url";

describe("expiry rules", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-03T09:30:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps output history visible but blocks signed download links after expiry", () => {
    resetTaskOutputStore();
    const output = saveTaskOutputRecord({
      taskId: "task-expire-1",
      userId: "u1",
      outputKind: "final_docx",
      storagePath: "users/u1/tasks/task-expire-1/final.docx",
      createdAt: "2026-03-01T10:00:00.000Z",
      expiresAt: "2026-03-04T10:00:00.000Z"
    });

    expireTaskOutputs({
      asOf: "2026-03-05T10:00:00.000Z"
    });

    const outputs = getTaskOutputs("task-expire-1");

    expect(outputs).toHaveLength(1);
    expect(outputs[0]?.expired).toBe(true);
    expect(() =>
      createSignedDownloadUrl({
        output: outputs[0]!,
        userId: "u1"
      })
    ).toThrow("This file has expired");
  });

  it("allows signed downloads while the file is still within 3 days", () => {
    resetTaskOutputStore();
    const output = saveTaskOutputRecord({
      taskId: "task-expire-2",
      userId: "u2",
      outputKind: "reference_report_pdf",
      storagePath: "users/u2/tasks/task-expire-2/report.pdf",
      createdAt: "2026-03-02T09:00:00.000Z",
      expiresAt: "2026-03-05T09:00:00.000Z"
    });

    const signedUrl = createSignedDownloadUrl({
      output,
      userId: "u2"
    });

    expect(signedUrl).toContain("signature=");
    expect(signedUrl).toContain(
      "path=users%2Fu2%2Ftasks%2Ftask-expire-2%2Freport.pdf"
    );
  });

  it("only expires file outputs and leaves the task row itself untouched", () => {
    resetTaskOutputStore();
    saveTaskOutputRecord({
      taskId: "task-expire-3",
      userId: "u3",
      outputKind: "humanized_docx",
      storagePath: "users/u3/tasks/task-expire-3/humanized.docx",
      createdAt: "2026-03-01T08:00:00.000Z",
      expiresAt: "2026-03-04T08:00:00.000Z"
    });

    const result = expireTaskOutputs({
      asOf: "2026-03-05T08:30:00.000Z"
    });

    expect(result.expiredOutputIds).toHaveLength(1);
    expect(result.taskHistoryStillVisible).toBe(true);
  });
});

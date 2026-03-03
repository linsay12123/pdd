import { describe, expect, it, vi } from "vitest";
import { requestTaskDownload } from "../../src/lib/tasks/request-task-download";

describe("requestTaskDownload", () => {
  it("returns the signed download url from the task download endpoint", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          signedUrl: "/api/storage/download?path=test.docx&signature=abc123"
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );

    const result = await requestTaskDownload({
      taskId: "task-1",
      outputId: "out-1",
      fetchImpl
    });

    expect(result.signedUrl).toContain("signature=abc123");
    expect(fetchImpl).toHaveBeenCalledWith("/api/tasks/task-1/downloads/out-1");
  });
});

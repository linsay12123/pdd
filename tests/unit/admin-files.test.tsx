import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const fromMock = vi.fn();

vi.mock("../../src/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: fromMock
  })
}));

describe("admin files", () => {
  it("loads real output files with task and user details", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "task_outputs") {
        return {
          select: () => ({
            order: async () => ({
              data: [
                {
                  id: "out-1",
                  task_id: "task-1",
                  user_id: "user-1",
                  output_kind: "final_docx",
                  is_active: true,
                  created_at: "2026-03-03T10:00:00.000Z",
                  expires_at: "2026-03-06T10:00:00.000Z"
                }
              ],
              error: null
            })
          })
        };
      }

      if (table === "writing_tasks") {
        return {
          select: () => ({
            in: async () => ({
              data: [
                {
                  id: "task-1",
                  title: "Risk Report",
                  topic: null
                }
              ],
              error: null
            })
          })
        };
      }

      if (table === "profiles") {
        return {
          select: () => ({
            in: async () => ({
              data: [
                {
                  id: "user-1",
                  email: "files@example.com",
                  display_name: "文件用户"
                }
              ],
              error: null
            })
          })
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const { listAdminFiles } = await import("../../src/lib/admin/files");
    const files = await listAdminFiles({
      shouldUseSupabase: () => true,
      now: () => "2026-03-03T12:00:00.000Z"
    });

    expect(files).toEqual([
      expect.objectContaining({
        id: "out-1",
        outputLabel: "最终版文章 Word",
        taskTitle: "Risk Report",
        userEmail: "files@example.com",
        status: "active"
      })
    ]);
  });

  it("renders homepage-style file cards", async () => {
    const { FileTableView } = await import("../../src/components/admin/file-table");
    const html = renderToStaticMarkup(
      <FileTableView
        files={[
          {
            id: "out-2",
            taskId: "task-2",
            userId: "user-2",
            userEmail: "owner@example.com",
            userDisplayName: "文件演示用户",
            taskTitle: "Reference Validation",
            outputKind: "reference_report_pdf",
            outputLabel: "引用核验 PDF",
            status: "expired",
            createdAt: "2026-03-03T09:00:00.000Z",
            expiresAt: "2026-03-03T10:00:00.000Z"
          }
        ]}
      />
    );

    expect(html).toContain("文件管理");
    expect(html).toContain("引用核验 PDF");
    expect(html).toContain("已过期");
    expect(html).not.toContain("file_001");
  });
});

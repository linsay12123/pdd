import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const fromMock = vi.fn();

vi.mock("../../src/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: fromMock
  })
}));

describe("admin tasks", () => {
  it("loads real tasks with their owners", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "writing_tasks") {
        return {
          select: () => ({
            order: async () => ({
              data: [
                {
                  id: "task-1",
                  user_id: "user-1",
                  status: "awaiting_outline_approval",
                  title: "Cross-border banking strategy",
                  topic: null,
                  target_word_count: 2200,
                  citation_style: "APA 7",
                  outline_revision_count: 2,
                  created_at: "2026-03-03T11:00:00.000Z",
                  expires_at: "2026-03-06T11:00:00.000Z"
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
                  email: "task-owner@example.com",
                  display_name: "任务拥有者"
                }
              ],
              error: null
            })
          })
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const { listAdminTasks } = await import("../../src/lib/admin/tasks");
    const tasks = await listAdminTasks({
      shouldUseSupabase: () => true
    });

    expect(tasks).toEqual([
      expect.objectContaining({
        id: "task-1",
        userEmail: "task-owner@example.com",
        userDisplayName: "任务拥有者",
        title: "Cross-border banking strategy",
        status: "awaiting_outline_approval",
        targetWordCount: 2200
      })
    ]);
  });

  it("renders homepage-style task cards with live status", async () => {
    const { TaskTableView } = await import("../../src/components/admin/task-table");
    const html = renderToStaticMarkup(
      <TaskTableView
        tasks={[
          {
            id: "task-2",
            userId: "user-2",
            userEmail: "owner@example.com",
            userDisplayName: "演示任务用户",
            status: "awaiting_outline_approval",
            title: "Supply Chain Risk Review",
            targetWordCount: 3000,
            citationStyle: "MLA",
            outlineRevisionCount: 1,
            createdAt: "2026-03-03T09:30:00.000Z",
            expiresAt: "2026-03-06T09:30:00.000Z"
          }
        ]}
      />
    );

    expect(html).toContain("任务管理");
    expect(html).toContain("Supply Chain Risk Review");
    expect(html).toContain("大纲已生成，等待用户确认");
    expect(html).toContain("3,000");
    expect(html).not.toContain("下一步接成真");
    expect(html).not.toContain("补真重试按钮");
    expect(html).not.toContain("task_001");
  });
});

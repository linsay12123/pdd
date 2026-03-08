import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const deactivateMock = vi.fn();
const insertSelectSingleMock = vi.fn();
let insertedRow: Record<string, unknown> | null = null;

vi.mock("server-only", () => ({}));

vi.mock("../../src/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: (table: string) => {
      if (table !== "task_outputs") {
        throw new Error(`unexpected table: ${table}`);
      }

      const updateChain: {
        eq: (column: string) => typeof updateChain | Promise<{ error: null }>;
      } = {
        eq: () => updateChain
      };
      updateChain.eq = (column: string) => {
        if (column === "is_active") {
          return deactivateMock() as Promise<{ error: null }>;
        }

        return updateChain;
      };

      return {
        update: () => updateChain,
        insert: (row: Record<string, unknown>) => {
          insertedRow = row;
          return {
            select: () => ({
              single: insertSelectSingleMock
            })
          };
        }
      };
    }
  })
}));

describe("task output store", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-03T10:00:00.000Z"));
    deactivateMock.mockReset();
    insertSelectSingleMock.mockReset();
    insertedRow = null;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    deactivateMock.mockResolvedValue({ error: null });
    insertSelectSingleMock.mockImplementation(async () => ({
      data: {
        id: "out-1",
        task_id: insertedRow?.task_id ?? "task-id",
        user_id: insertedRow?.user_id ?? "user-1",
        output_kind: insertedRow?.output_kind ?? "final_docx",
        storage_path: insertedRow?.storage_path ?? "users/user-1/tasks/task-id/outputs/final.docx",
        is_active: insertedRow?.is_active ?? true,
        expires_at: insertedRow?.expires_at ?? null,
        created_at: insertedRow?.created_at ?? "2026-03-03T10:00:00.000Z"
      },
      error: null
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
  });

  it("writes a formal expires_at when saving a new persisted output", async () => {
    const { saveTaskOutput } = await import("../../src/lib/tasks/task-output-store");

    const output = await saveTaskOutput({
      taskId: "task-output-1",
      userId: "user-1",
      outputKind: "final_docx",
      storagePath: "users/user-1/tasks/task-output-1/outputs/final.docx"
    });

    expect(insertedRow).toEqual(
      expect.objectContaining({
        task_id: "task-output-1",
        user_id: "user-1",
        output_kind: "final_docx",
        created_at: "2026-03-03T10:00:00.000Z",
        expires_at: "2026-03-06T10:00:00.000Z"
      })
    );
    expect(output.expiresAt).toBe("2026-03-06T10:00:00.000Z");
  });
});

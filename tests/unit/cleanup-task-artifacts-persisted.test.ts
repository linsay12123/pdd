import { beforeEach, describe, expect, it, vi } from "vitest";

const taskOutputsQuery = vi.fn();

vi.mock("server-only", () => ({}));

vi.mock("../../src/lib/persistence/runtime-mode", () => ({
  shouldUseSupabasePersistence: () => true
}));

vi.mock("../../src/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: (table: string) => {
      if (table !== "task_outputs") {
        throw new Error(`unexpected table: ${table}`);
      }

      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => {
          taskOutputsQuery(column, value);
          return query;
        },
        lt: (column: string, value: unknown) => {
          taskOutputsQuery(column, value);
          return query;
        },
        is: (column: string, value: unknown) => {
          taskOutputsQuery(column, value);
          return query;
        },
        order: () => query,
        limit: async () => {
          const steps = taskOutputsQuery.mock.calls.map(([column, value]) => [column, value]);
          const isInactiveQuery = steps.some(
            ([column, value]) => column === "is_active" && value === false
          );
          const isExplicitExpiryQuery = steps.some(([column]) => column === "expires_at") &&
            steps.some(([column, value]) => column === "expires_at" && value !== null);
          const isLegacyNullExpiryQuery = steps.some(
            ([column, value]) => column === "expires_at" && value === null
          );

          taskOutputsQuery.mockClear();

          if (isInactiveQuery) {
            return { data: [], error: null };
          }

          if (isExplicitExpiryQuery) {
            return { data: [], error: null };
          }

          if (isLegacyNullExpiryQuery) {
            return {
              data: [
                {
                  id: "out-legacy-null-expiry",
                  user_id: "user-1",
                  storage_path: "users/user-1/tasks/task-1/outputs/final.docx"
                }
              ],
              error: null
            };
          }

          throw new Error(`unexpected task_outputs query: ${JSON.stringify(steps)}`);
        }
      };

      return query;
    }
  })
}));

describe("cleanup task artifacts persisted candidate selection", () => {
  beforeEach(() => {
    vi.resetModules();
    taskOutputsQuery.mockReset();
  });

  it("also cleans legacy output rows whose expires_at is null but created_at is older than 3 days", async () => {
    const deleteStorageObject = vi.fn().mockResolvedValue({ ok: true });
    const deleteOutputRecord = vi.fn().mockResolvedValue(undefined);
    const { cleanupTaskArtifacts } = await import("../../src/lib/storage/cleanup-task-artifacts");

    const result = await cleanupTaskArtifacts(
      {
        limit: 10,
        uploadRetentionDays: 3
      },
      {
        listUploadCandidates: async () => [],
        deleteStorageObject,
        deleteOutputRecord
      }
    );

    expect(deleteStorageObject).toHaveBeenCalledWith(
      "users/user-1/tasks/task-1/outputs/final.docx"
    );
    expect(deleteOutputRecord).toHaveBeenCalledWith("out-legacy-null-expiry", "user-1");
    expect(result.deletedOutputs).toBe(1);
  });
});

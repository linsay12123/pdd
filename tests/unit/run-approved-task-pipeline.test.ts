import { describe, expect, it, vi } from "vitest";
import type { FrozenQuotaReservation } from "../../src/types/billing";

vi.mock("server-only", () => ({}));

import { runApprovedTaskPipeline } from "../../src/lib/tasks/run-approved-task-pipeline";

const reservation: FrozenQuotaReservation = {
  reservationId: "res-1",
  taskId: "task-1",
  chargePath: "generation",
  totalAmount: 690,
  fromSubscription: 0,
  fromRecharge: 690
};

describe("run approved task pipeline", () => {
  it("marks the task deliverable_ready only after quota settlement succeeds", async () => {
    const setOwnedTaskStatusInSupabase = vi.fn().mockResolvedValue({
      id: "task-1",
      userId: "user-1",
      status: "deliverable_ready",
      targetWordCount: 1000,
      citationStyle: "Harvard",
      specialRequirements: "",
      lastWorkflowStage: "exporting"
    });
    const setOwnedTaskQuotaReservationInSupabase = vi.fn().mockResolvedValue(undefined);
    const processApprovedTask = vi.fn().mockResolvedValue({
      task: {
        id: "task-1",
        userId: "user-1",
        status: "exporting",
        targetWordCount: 1000,
        citationStyle: "Harvard",
        specialRequirements: "",
        latestDraftVersionId: "draft-1",
        lastWorkflowStage: "exporting"
      },
      outlineVersion: {
        id: "outline-1"
      },
      downloads: {
        finalDocxOutputId: "out-final",
        referenceReportOutputId: "out-report"
      },
      generatedOutputs: [
        {
          id: "out-final",
          userId: "user-1",
          storagePath: "users/user-1/tasks/task-1/outputs/final.docx"
        },
        {
          id: "out-report",
          userId: "user-1",
          storagePath: "users/user-1/tasks/task-1/outputs/reference-report.pdf"
        }
      ],
      finalDraftMarkdown: "Final draft"
    });

    const result = await runApprovedTaskPipeline(
      {
        taskId: "task-1",
        userId: "user-1"
      },
      {
        getOwnedTask: async () => ({
          id: "task-1",
          userId: "user-1",
          status: "drafting",
          targetWordCount: 1000,
          citationStyle: "Harvard",
          specialRequirements: "",
          quotaReservation: reservation
        }),
        processApprovedTask,
        settleReservedQuotaForTask: vi.fn().mockResolvedValue(undefined),
        setOwnedTaskStatusInSupabase,
        setOwnedTaskQuotaReservationInSupabase,
        releaseReservedQuotaForTask: vi.fn(),
        rollbackGeneratedOutputs: vi.fn()
      } as any
    );

    expect(processApprovedTask).toHaveBeenCalled();
    expect(setOwnedTaskQuotaReservationInSupabase).toHaveBeenCalledWith("task-1", "user-1", null);
    expect(setOwnedTaskStatusInSupabase).toHaveBeenCalledWith("task-1", "user-1", "deliverable_ready", {
      lastWorkflowStage: "exporting"
    });
    expect(result.task.status).toBe("deliverable_ready");
  });

  it("removes newly exported files and marks the task failed when settlement breaks after export", async () => {
    const rollbackGeneratedOutputs = vi.fn().mockResolvedValue(undefined);
    const releaseReservedQuotaForTask = vi.fn().mockResolvedValue(undefined);
    const setOwnedTaskStatusInSupabase = vi.fn().mockResolvedValue(undefined);
    const setOwnedTaskQuotaReservationInSupabase = vi.fn().mockResolvedValue(undefined);

    await expect(
      runApprovedTaskPipeline(
        {
          taskId: "task-1",
          userId: "user-1"
        },
        {
          getOwnedTask: async () => ({
            id: "task-1",
            userId: "user-1",
            status: "drafting",
            targetWordCount: 1000,
            citationStyle: "Harvard",
            specialRequirements: "",
            quotaReservation: reservation
          }),
          processApprovedTask: vi.fn().mockResolvedValue({
            task: {
              id: "task-1",
              userId: "user-1",
              status: "exporting",
              targetWordCount: 1000,
              citationStyle: "Harvard",
              specialRequirements: "",
              latestDraftVersionId: "draft-1",
              lastWorkflowStage: "exporting"
            },
            outlineVersion: {
              id: "outline-1"
            },
            downloads: {
              finalDocxOutputId: "out-final",
              referenceReportOutputId: "out-report"
            },
            generatedOutputs: [
              {
                id: "out-final",
                userId: "user-1",
                storagePath: "users/user-1/tasks/task-1/outputs/final.docx"
              },
              {
                id: "out-report",
                userId: "user-1",
                storagePath: "users/user-1/tasks/task-1/outputs/reference-report.pdf"
              }
            ],
            finalDraftMarkdown: "Final draft"
          }),
          settleReservedQuotaForTask: vi.fn().mockRejectedValue(new Error("SETTLE_WALLET_CONFLICT")),
          rollbackGeneratedOutputs,
          releaseReservedQuotaForTask,
          setOwnedTaskStatusInSupabase,
          setOwnedTaskQuotaReservationInSupabase
        } as any
      )
    ).rejects.toThrow("SETTLE_WALLET_CONFLICT");

    expect(rollbackGeneratedOutputs).toHaveBeenCalledWith([
      {
        id: "out-final",
        userId: "user-1",
        storagePath: "users/user-1/tasks/task-1/outputs/final.docx"
      },
      {
        id: "out-report",
        userId: "user-1",
        storagePath: "users/user-1/tasks/task-1/outputs/reference-report.pdf"
      }
    ]);
    expect(releaseReservedQuotaForTask).toHaveBeenCalledWith("task-1", "user-1", reservation);
    expect(setOwnedTaskQuotaReservationInSupabase).toHaveBeenCalledWith("task-1", "user-1", null);
    expect(setOwnedTaskStatusInSupabase).toHaveBeenCalledWith("task-1", "user-1", "failed", {
      lastWorkflowStage: "exporting"
    });
  });
});

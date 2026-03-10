import { task } from "@trigger.dev/sdk/v3";
import { runApprovedTaskPipeline } from "@/src/lib/tasks/run-approved-task-pipeline";

export type ProcessApprovedTaskJobInput = {
  taskId: string;
  userId: string;
  safetyIdentifier?: string;
  approvalAttemptCount: number;
};

export const processApprovedTaskJob = task({
  id: "process-approved-task",
  retry: {
    maxAttempts: 1
  },
  maxDuration: 3600,
  run: async (payload: ProcessApprovedTaskJobInput) => {
    return runApprovedTaskPipeline(payload);
  }
});

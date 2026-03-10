import { task } from "@trigger.dev/sdk/v3";
import { verifyApprovedTaskStartup } from "@/src/lib/tasks/verify-approved-task-startup";

export type VerifyApprovedTaskStartupJobInput = {
  taskId: string;
  userId: string;
  approvalAttemptCount: number;
  triggerRunId: string;
};

export const verifyApprovedTaskStartupJob = task({
  id: "verify-approved-task-startup",
  retry: {
    maxAttempts: 1
  },
  maxDuration: 120,
  run: async (payload: VerifyApprovedTaskStartupJobInput) => {
    return verifyApprovedTaskStartup(payload);
  }
});

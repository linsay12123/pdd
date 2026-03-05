import { schedules } from "@trigger.dev/sdk/v3";
import { cleanupTaskArtifacts } from "@/src/lib/storage/cleanup-task-artifacts";

export const cleanupTaskArtifactsJob = schedules.task({
  id: "cleanup-task-artifacts",
  cron: {
    pattern: "*/30 * * * *",
    environments: ["PRODUCTION"]
  },
  retry: {
    maxAttempts: 1
  },
  maxDuration: 300,
  run: async () => {
    const summary = await cleanupTaskArtifacts({
      limit: 200,
      uploadRetentionDays: 3
    });

    return {
      summary
    };
  }
});

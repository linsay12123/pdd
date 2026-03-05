import { schedules } from "@trigger.dev/sdk/v3";
import { cleanupStaleQuotaReservations } from "@/src/lib/billing/cleanup-stale-reservations";
import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";

export const cleanupStaleQuotaReservationsJob = schedules.task({
  id: "cleanup-stale-quota-reservations",
  cron: {
    pattern: "*/10 * * * *",
    environments: ["PRODUCTION"]
  },
  retry: {
    maxAttempts: 1
  },
  maxDuration: 300,
  run: async () => {
    if (!shouldUseSupabasePersistence()) {
      return {
        jobSkipped: true,
        reason: "REAL_PERSISTENCE_REQUIRED"
      };
    }

    const cleaned = await cleanupStaleQuotaReservations();
    return {
      jobSkipped: false,
      summary: cleaned
    };
  }
});

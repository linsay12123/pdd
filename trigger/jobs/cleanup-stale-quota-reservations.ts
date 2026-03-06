import { schedules } from "@trigger.dev/sdk/v3";
import { cleanupStaleQuotaReservations } from "@/src/lib/billing/cleanup-stale-reservations";
import { requireFormalPersistence, shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";

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
      requireFormalPersistence();
    }

    const cleaned = await cleanupStaleQuotaReservations();
    return {
      jobSkipped: false,
      summary: cleaned
    };
  }
});

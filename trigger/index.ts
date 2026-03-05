import { analyzeUploadedTaskJob } from "./jobs/analyze-uploaded-task";
import { cleanupStaleQuotaReservationsJob } from "./jobs/cleanup-stale-quota-reservations";
import { expireTaskAssets } from "./jobs/expire-task-assets";
import { generateOutlineForTask } from "./jobs/generate-outline";
import { humanizeDraftTask } from "./jobs/humanize-draft";
import { verifyReferencesForDraft } from "./jobs/verify-references";

export const registeredTriggerJobs = {
  analyzeUploadedTaskJob,
  cleanupStaleQuotaReservationsJob,
  expireTaskAssets,
  generateOutlineForTask,
  humanizeDraftTask,
  verifyReferencesForDraft
};

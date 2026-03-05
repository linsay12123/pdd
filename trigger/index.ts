import { analyzeUploadedTaskJob } from "./jobs/analyze-uploaded-task";
import { cleanupTaskArtifactsJob } from "./jobs/cleanup-task-artifacts";
import { cleanupStaleQuotaReservationsJob } from "./jobs/cleanup-stale-quota-reservations";
import { expireTaskAssets } from "./jobs/expire-task-assets";
import { generateOutlineForTask } from "./jobs/generate-outline";
import { humanizeDraftTask } from "./jobs/humanize-draft";
import { verifyReferencesForDraft } from "./jobs/verify-references";

export const registeredTriggerJobs = {
  analyzeUploadedTaskJob,
  cleanupTaskArtifactsJob,
  cleanupStaleQuotaReservationsJob,
  expireTaskAssets,
  generateOutlineForTask,
  humanizeDraftTask,
  verifyReferencesForDraft
};

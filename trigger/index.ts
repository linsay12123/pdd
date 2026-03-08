import { analyzeUploadedTaskJob } from "./jobs/analyze-uploaded-task";
import { cleanupTaskArtifactsJob } from "./jobs/cleanup-task-artifacts";
import { cleanupStaleQuotaReservationsJob } from "./jobs/cleanup-stale-quota-reservations";
import { generateOutlineForTask } from "./jobs/generate-outline";
import { humanizeDraftTask } from "./jobs/humanize-draft";
import { processApprovedTaskJob } from "./jobs/process-approved-task";
import { verifyReferencesForDraft } from "./jobs/verify-references";

export const registeredTriggerJobs = {
  analyzeUploadedTaskJob,
  cleanupTaskArtifactsJob,
  cleanupStaleQuotaReservationsJob,
  generateOutlineForTask,
  humanizeDraftTask,
  processApprovedTaskJob,
  verifyReferencesForDraft
};

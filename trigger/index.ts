import { generateOutlineForTask } from "./jobs/generate-outline";
import { processUploadedTask } from "./jobs/process-uploaded-task";
import { verifyReferencesForDraft } from "./jobs/verify-references";

export const registeredTriggerJobs = {
  processUploadedTask,
  generateOutlineForTask,
  verifyReferencesForDraft
};

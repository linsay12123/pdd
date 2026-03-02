import { generateOutlineForTask } from "./jobs/generate-outline";
import { grantSubscriptionQuota } from "./jobs/grant-subscription-quota";
import { humanizeDraft } from "./jobs/humanize-draft";
import { processUploadedTask } from "./jobs/process-uploaded-task";
import { verifyReferencesForDraft } from "./jobs/verify-references";

export const registeredTriggerJobs = {
  processUploadedTask,
  generateOutlineForTask,
  grantSubscriptionQuota,
  humanizeDraft,
  verifyReferencesForDraft
};

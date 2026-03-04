import { expireTaskAssets } from "./jobs/expire-task-assets";
import { generateOutlineForTask } from "./jobs/generate-outline";
import { humanizeDraftTask } from "./jobs/humanize-draft";
import { verifyReferencesForDraft } from "./jobs/verify-references";

export const registeredTriggerJobs = {
  expireTaskAssets,
  generateOutlineForTask,
  humanizeDraftTask,
  verifyReferencesForDraft
};

import { generateOutlineForTask } from "./jobs/generate-outline";
import { processUploadedTask } from "./jobs/process-uploaded-task";

export const registeredTriggerJobs = {
  processUploadedTask,
  generateOutlineForTask
};

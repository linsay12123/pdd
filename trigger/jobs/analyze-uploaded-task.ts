import { task } from "@trigger.dev/sdk/v3";
import {
  runAnalyzeUploadedTaskPipeline,
  type AnalyzeUploadedTaskJobInput
} from "@/src/lib/tasks/analyze-uploaded-task-pipeline";

export const analyzeUploadedTaskJob = task({
  id: "analyze-uploaded-task",
  retry: {
    maxAttempts: 1
  },
  maxDuration: 2700,
  run: async (payload: AnalyzeUploadedTaskJobInput) => {
    return runAnalyzeUploadedTaskPipeline(payload);
  }
});

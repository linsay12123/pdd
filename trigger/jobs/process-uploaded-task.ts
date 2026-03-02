import { classifyFilesByHeuristics, type TaskFileCandidate } from "@/src/lib/ai/services/classify-files";

export async function processUploadedTask(taskId: string, files: TaskFileCandidate[]) {
  const classification = classifyFilesByHeuristics(files);

  return {
    taskId,
    nextStep: classification.needsUserConfirmation
      ? "awaiting_primary_file_confirmation"
      : "building_rule_card",
    classification
  };
}

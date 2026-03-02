import {
  buildInitialRuleCard,
  type BackgroundRuleHints,
  type WritingRuleCard
} from "@/src/lib/ai/services/build-rule-card";
import { extractPrimaryTaskHints } from "@/src/lib/ai/services/classify-files";
import type { OutlineScaffold } from "@/src/lib/ai/prompts/generate-outline";
import { generateOutlineForTask } from "@/trigger/jobs/generate-outline";
import type { TaskFileRecord, TaskSummary } from "@/src/types/tasks";

export type TaskOutlineBundle = {
  ruleCard: WritingRuleCard;
  outline: OutlineScaffold;
};

export async function buildTaskOutlineBundle({
  task,
  files,
  primaryRequirementFileId
}: {
  task: TaskSummary;
  files: TaskFileRecord[];
  primaryRequirementFileId: string;
}): Promise<TaskOutlineBundle> {
  const primaryFile = files.find((file) => file.id === primaryRequirementFileId);

  if (!primaryFile) {
    throw new Error("PRIMARY_FILE_NOT_FOUND");
  }

  const backgroundFiles = files.filter(
    (file) => file.id !== primaryRequirementFileId && file.role === "background"
  );

  const ruleCard = buildInitialRuleCard({
    primaryTaskHints: extractPrimaryTaskHints(primaryFile.extractedText),
    backgroundHints: buildBackgroundHints(backgroundFiles),
    userSpecialRequirements: task.specialRequirements ?? ""
  });
  const outline = await generateOutlineForTask({
    topic: ruleCard.topic,
    targetWordCount: ruleCard.targetWordCount,
    citationStyle: ruleCard.citationStyle,
    chapterCountOverride: ruleCard.chapterCountOverride
  });

  return {
    ruleCard,
    outline
  };
}

function buildBackgroundHints(files: TaskFileRecord[]): BackgroundRuleHints {
  const topicHints = files
    .map((file) => extractPrimaryTaskHints(file.extractedText).topic)
    .filter((value): value is string => Boolean(value));

  return {
    topicHints
  };
}

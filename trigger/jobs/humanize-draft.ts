import { exportDocx } from "@/src/lib/deliverables/export-docx";
import {
  draftToDocxContent,
  humanizeDraftWithStealthGpt
} from "@/src/lib/humanize/stealthgpt-client";
import { getTaskSummary, updateTaskStatus } from "@/src/lib/tasks/repository";

export type HumanizeDraftJobInput = {
  taskId: string;
  draftMarkdown: string;
};

export async function queueHumanizeDraft(input: HumanizeDraftJobInput) {
  return {
    job: "humanizeDraft",
    queued: true,
    input
  };
}

export async function humanizeDraft(input: HumanizeDraftJobInput) {
  const task = getTaskSummary(input.taskId);

  if (task) {
    updateTaskStatus(input.taskId, "humanizing");
  }

  const humanizedDraft = await humanizeDraftWithStealthGpt({
    draftMarkdown: input.draftMarkdown
  });
  const docxContent = draftToDocxContent(humanizedDraft);
  const exportResult = await exportDocx({
    taskId: input.taskId,
    title: docxContent.title,
    sections: docxContent.sections,
    references:
      docxContent.references.length > 0
        ? docxContent.references
        : ["References preserved in the source draft."],
    citationStyle: task?.citationStyle ?? "APA 7",
    variant: "humanized",
    outputKind: "humanized_docx"
  });

  if (task) {
    updateTaskStatus(input.taskId, "humanized_ready");
  }

  return {
    taskId: input.taskId,
    humanizedDraft,
    outputPath: exportResult.outputPath
  };
}

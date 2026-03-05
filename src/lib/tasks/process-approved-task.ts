import { buildAdjustWordCountPrompt } from "@/src/lib/ai/prompts/adjust-word-count";
import { defaultOpenAIModel, requestOpenAITextResponse } from "@/src/lib/ai/openai-client";
import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import { mapReferenceVerdictLabel } from "@/src/lib/references/verification-rules";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { exportDocx, type DocxExportInput } from "@/src/lib/deliverables/export-docx";
import {
  exportReferenceReport,
  type ReferenceReportInput
} from "@/src/lib/deliverables/export-report";
import { applyCandidateDraft } from "@/src/lib/drafts/word-count";
import { draftToDocxContent } from "@/src/lib/humanize/humanize-markdown";
import {
  getTaskOutlineVersion,
  getTaskSummary,
  updateTaskStatus
} from "@/src/lib/tasks/repository";
import { saveDraftVersion } from "@/src/lib/tasks/save-draft-version";
import { saveReferenceChecks } from "@/src/lib/tasks/save-reference-checks";
import { listOwnedTaskOutputs } from "@/src/lib/tasks/task-output-store";
import type {
  TaskOutlineVersion,
  TaskSummary
} from "@/src/types/tasks";
import { generateDraftFromOutline } from "@/trigger/jobs/generate-draft";
import { verifyReferencesForDraft } from "@/trigger/jobs/verify-references";

export class TaskProcessingStageError extends Error {
  stage: "drafting" | "adjusting_word_count" | "verifying_references" | "exporting";
  cause?: unknown;

  constructor(
    stage: "drafting" | "adjusting_word_count" | "verifying_references" | "exporting",
    cause: unknown
  ) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = "TaskProcessingStageError";
    this.stage = stage;
    this.cause = cause;
  }
}

type RewriteDraftResult = {
  prompt: string;
  candidateDraft: string;
};

type ProcessDocxExporter = (
  input: DocxExportInput & {
    userId?: string;
  }
) => Promise<{
  outputPath: string;
  payloadPath: string;
}>;

type ProcessReferenceReportExporter = (
  input: ReferenceReportInput & {
    userId?: string;
  }
) => Promise<{
  outputPath: string;
  payloadPath: string;
}>;

type ProcessApprovedTaskDependencies = {
  generateDraft?: typeof generateDraftFromOutline;
  rewriteDraftToTarget?: (input: {
    currentDraft: string;
    targetWordCount: number;
    citationStyle: string;
    safetyIdentifier?: string;
  }) => Promise<RewriteDraftResult>;
  verifyReferences?: typeof verifyReferencesForDraft;
  exportDocx?: ProcessDocxExporter;
  exportReferenceReport?: ProcessReferenceReportExporter;
};

type ProcessApprovedTaskInput = {
  taskId: string;
  userId: string;
  safetyIdentifier?: string;
};

type ProcessApprovedTaskResult = {
  task: TaskSummary;
  outlineVersion: TaskOutlineVersion;
  downloads: {
    finalDocxOutputId: string | null;
    referenceReportOutputId: string | null;
  };
  finalDraftMarkdown: string;
};

const defaultDocxExporter: ProcessDocxExporter = async (input) => exportDocx(input);

const defaultReferenceReportExporter: ProcessReferenceReportExporter = async (input) =>
  exportReferenceReport(input);

export async function processApprovedTask(
  input: ProcessApprovedTaskInput,
  dependencies: ProcessApprovedTaskDependencies = {}
): Promise<ProcessApprovedTaskResult> {
  const context = await loadApprovedTaskContext(input.taskId, input.userId);
  const targetWordCount = requireTaskTargetWordCount(context.task);
  const citationStyle = requireTaskCitationStyle(context.task);

  const generateDraft = dependencies.generateDraft ?? generateDraftFromOutline;
  const rewriteDraftToTarget = dependencies.rewriteDraftToTarget ?? requestAdjustedDraft;
  const verifyReferences = dependencies.verifyReferences ?? verifyReferencesForDraft;
  const exportDocxImpl = dependencies.exportDocx ?? defaultDocxExporter;
  const exportReferenceReportImpl =
    dependencies.exportReferenceReport ?? defaultReferenceReportExporter;

  const draftResult = await runTaskStage("drafting", async () => {
    return generateDraft({
      outline: context.outlineVersion.outline,
      specialRequirements: context.task.specialRequirements,
      safetyIdentifier: input.safetyIdentifier
    });
  });
  const initialDraft = await runTaskStage("drafting", async () => {
    return saveDraftVersion({
      taskId: input.taskId,
      userId: input.userId,
      markdown: draftResult.draft,
      isActive: true,
      isCandidate: false
    });
  });

  await setTaskStatus(input.taskId, input.userId, "adjusting_word_count");

  const rewrittenDraft = await runTaskStage("adjusting_word_count", async () => {
    return rewriteDraftToTarget({
      currentDraft: draftResult.draft,
      targetWordCount,
      citationStyle,
      safetyIdentifier: input.safetyIdentifier
    });
  });
  await runTaskStage("adjusting_word_count", async () => {
    return saveDraftVersion({
      taskId: input.taskId,
      userId: input.userId,
      markdown: rewrittenDraft.candidateDraft,
      isActive: false,
      isCandidate: true
    });
  });

  const wordCountResult = await runTaskStage("adjusting_word_count", async () => {
    return applyCandidateDraft({
      currentDraft: draftResult.draft,
      candidateDraft: rewrittenDraft.candidateDraft,
      targetWordCount
    });
  });

  const finalDraftVersion = wordCountResult.candidateWasPromoted
    ? await runTaskStage("adjusting_word_count", async () => {
        return saveDraftVersion({
          taskId: input.taskId,
          userId: input.userId,
          markdown: wordCountResult.chosenDraft,
          isActive: true,
          isCandidate: false
        });
      })
    : initialDraft;

  await setTaskStatus(input.taskId, input.userId, "verifying_references");

  const referenceChecks = await runTaskStage("verifying_references", async () => {
    return verifyReferences({
      draftMarkdown: wordCountResult.chosenDraft,
      claimText: finalDraftVersion.bodyMarkdown
    });
  });
  await runTaskStage("verifying_references", async () => {
    return saveReferenceChecks({
      taskId: input.taskId,
      draftVersionId: finalDraftVersion.id,
      userId: input.userId,
      checks: referenceChecks.map((check) => ({
        rawReference: check.rawReference,
        verdict: check.verdict,
        reasoning: check.reasoning,
        detectedTitle: check.detectedTitle,
        detectedYear: check.detectedYear,
        detectedDoi: check.detectedDoi,
        detectedUrl: check.detectedUrl
      }))
    });
  });

  await setTaskStatus(input.taskId, input.userId, "exporting");

  const docxContent = draftToDocxContent(wordCountResult.chosenDraft);
  await runTaskStage("exporting", async () => {
    return exportDocxImpl({
      taskId: input.taskId,
      userId: input.userId,
      title: docxContent.title,
      sections: docxContent.sections,
      references:
        docxContent.references.length > 0
          ? docxContent.references
          : ["References preserved in the source draft."],
      citationStyle
    });
  });
  await runTaskStage("exporting", async () => {
    return exportReferenceReportImpl({
      taskId: input.taskId,
      userId: input.userId,
      reportId: `REF-${input.taskId.slice(0, 8).toUpperCase()}`,
      createdAt: new Date().toISOString(),
      taskSummary: {
        targetWordCount,
        citationStyle
      },
      entries: referenceChecks.map((check) => ({
        rawReference: check.rawReference,
        verdictLabel: mapReferenceVerdictLabel(check.verdict),
        reasoning: check.reasoning
      })),
      closingSummary: buildReferenceClosingSummary(referenceChecks.length)
    });
  });

  const nextTask = await setTaskStatus(input.taskId, input.userId, "deliverable_ready");
  const outputs = await listOwnedTaskOutputs({
    taskId: input.taskId,
    userId: input.userId
  });

  return {
    task: nextTask,
    outlineVersion: context.outlineVersion,
    downloads: {
      finalDocxOutputId:
        outputs.find((output) => output.outputKind === "final_docx")?.id ?? null,
      referenceReportOutputId:
        outputs.find((output) => output.outputKind === "reference_report_pdf")?.id ?? null
    },
    finalDraftMarkdown: wordCountResult.chosenDraft
  };
}

async function runTaskStage<T>(
  stage: "drafting" | "adjusting_word_count" | "verifying_references" | "exporting",
  action: () => Promise<T> | T
) {
  try {
    return await action();
  } catch (error) {
    throw new TaskProcessingStageError(stage, error);
  }
}

async function requestAdjustedDraft({
  currentDraft,
  targetWordCount,
  safetyIdentifier
}: {
  currentDraft: string;
  targetWordCount: number;
  citationStyle: string;
  safetyIdentifier?: string;
}): Promise<RewriteDraftResult> {
  const currentWordCount = applyCandidateDraft({
    currentDraft,
    candidateDraft: currentDraft,
    targetWordCount
  }).currentWordCount;
  const prompt = buildAdjustWordCountPrompt({
    draft: currentDraft,
    currentWordCount,
    targetWordCount
  });
  const response = await requestOpenAITextResponse({
    input: prompt,
    model: defaultOpenAIModel,
    reasoningEffort: "medium",
    safetyIdentifier
  });

  return {
    prompt,
    candidateDraft: response.output_text.trim() || currentDraft
  };
}

async function loadApprovedTaskContext(taskId: string, userId: string) {
  return shouldUseSupabasePersistence()
    ? loadApprovedTaskContextWithSupabase(taskId, userId)
    : loadApprovedTaskContextLocally(taskId, userId);
}

function loadApprovedTaskContextLocally(taskId: string, userId: string) {
  const task = getTaskSummary(taskId);

  if (!task || task.userId !== userId) {
    throw new Error("TASK_NOT_FOUND");
  }

  const outlineVersionId = task.latestOutlineVersionId;

  if (!outlineVersionId) {
    throw new Error("OUTLINE_VERSION_NOT_FOUND");
  }

  const outlineVersion = getTaskOutlineVersion(taskId, outlineVersionId);

  if (!outlineVersion || outlineVersion.userId !== userId || !outlineVersion.isApproved) {
    throw new Error("OUTLINE_VERSION_NOT_FOUND");
  }

  if (typeof task.targetWordCount !== "number" || !task.citationStyle) {
    throw new Error("TASK_REQUIREMENTS_NOT_READY");
  }

  return {
    task,
    outlineVersion
  };
}

async function loadApprovedTaskContextWithSupabase(taskId: string, userId: string) {
  const client = createSupabaseAdminClient();
  const { data: taskRow, error: taskError } = await client
    .from("writing_tasks")
    .select(
      "id,user_id,status,target_word_count,citation_style,special_requirements,topic,requested_chapter_count,outline_revision_count,primary_requirement_file_id,latest_outline_version_id,latest_draft_version_id,current_candidate_draft_id"
    )
    .eq("id", taskId)
    .eq("user_id", userId)
    .maybeSingle();

  if (taskError) {
    throw new Error(`读取任务失败：${taskError.message}`);
  }

  if (!taskRow) {
    throw new Error("TASK_NOT_FOUND");
  }

  const outlineVersionId = taskRow.latest_outline_version_id;

  if (!outlineVersionId) {
    throw new Error("OUTLINE_VERSION_NOT_FOUND");
  }

  const { data: outlineRow, error: outlineError } = await client
    .from("outline_versions")
    .select(
      "id,task_id,user_id,version_number,english_outline,feedback,is_approved,target_word_count,citation_style,created_at"
    )
    .eq("id", outlineVersionId)
    .eq("task_id", taskId)
    .eq("user_id", userId)
    .eq("is_approved", true)
    .maybeSingle();

  if (outlineError) {
    throw new Error(`读取已确认大纲失败：${outlineError.message}`);
  }

  if (!outlineRow) {
    throw new Error("OUTLINE_VERSION_NOT_FOUND");
  }

  return {
    task: {
      id: String(taskRow.id),
      userId: String(taskRow.user_id),
      status: taskRow.status,
      targetWordCount:
        typeof taskRow.target_word_count === "number"
          ? Number(taskRow.target_word_count)
          : null,
      citationStyle: taskRow.citation_style ? String(taskRow.citation_style) : null,
      specialRequirements: String(taskRow.special_requirements ?? ""),
      topic: taskRow.topic ? String(taskRow.topic) : undefined,
      requestedChapterCount:
        typeof taskRow.requested_chapter_count === "number"
          ? Number(taskRow.requested_chapter_count)
          : null,
      outlineRevisionCount: Number(taskRow.outline_revision_count ?? 0),
      primaryRequirementFileId: taskRow.primary_requirement_file_id
        ? String(taskRow.primary_requirement_file_id)
        : null,
      latestOutlineVersionId: String(taskRow.latest_outline_version_id),
      latestDraftVersionId: taskRow.latest_draft_version_id
        ? String(taskRow.latest_draft_version_id)
        : null,
      currentCandidateDraftId: taskRow.current_candidate_draft_id
        ? String(taskRow.current_candidate_draft_id)
        : null
    } satisfies TaskSummary,
    outlineVersion: {
      id: String(outlineRow.id),
      taskId: String(outlineRow.task_id),
      userId: String(outlineRow.user_id),
      versionNumber: Number(outlineRow.version_number),
      outline: JSON.parse(String(outlineRow.english_outline)),
      feedback: String(outlineRow.feedback ?? ""),
      isApproved: Boolean(outlineRow.is_approved),
      targetWordCount: Number(outlineRow.target_word_count),
      citationStyle: String(outlineRow.citation_style),
      createdAt: String(outlineRow.created_at)
    } satisfies TaskOutlineVersion
  };
}

function requireTaskTargetWordCount(task: TaskSummary) {
  if (typeof task.targetWordCount !== "number") {
    throw new Error("TASK_REQUIREMENTS_NOT_READY");
  }

  return task.targetWordCount;
}

function requireTaskCitationStyle(task: TaskSummary) {
  if (!task.citationStyle) {
    throw new Error("TASK_REQUIREMENTS_NOT_READY");
  }

  return task.citationStyle;
}

async function setTaskStatus(taskId: string, userId: string, status: TaskSummary["status"]) {
  return shouldUseSupabasePersistence()
    ? setTaskStatusWithSupabase(taskId, userId, status)
    : setTaskStatusLocally(taskId, status);
}

function setTaskStatusLocally(taskId: string, status: TaskSummary["status"]) {
  const nextTask = updateTaskStatus(taskId, status);

  if (!nextTask) {
    throw new Error("TASK_NOT_FOUND");
  }

  return nextTask;
}

async function setTaskStatusWithSupabase(
  taskId: string,
  userId: string,
  status: TaskSummary["status"]
) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("writing_tasks")
    .update({
      status
    })
    .eq("id", taskId)
    .eq("user_id", userId)
    .select(
      "id,user_id,status,target_word_count,citation_style,special_requirements,topic,requested_chapter_count,outline_revision_count,primary_requirement_file_id,latest_outline_version_id,latest_draft_version_id,current_candidate_draft_id"
    )
    .maybeSingle();

  if (error) {
    throw new Error(`更新任务状态失败：${error.message}`);
  }

  if (!data) {
    throw new Error("TASK_NOT_FOUND");
  }

  return {
    id: String(data.id),
    userId: String(data.user_id),
    status: data.status,
    targetWordCount: Number(data.target_word_count),
    citationStyle: String(data.citation_style),
    specialRequirements: String(data.special_requirements ?? ""),
    topic: data.topic ? String(data.topic) : undefined,
    requestedChapterCount:
      typeof data.requested_chapter_count === "number"
        ? Number(data.requested_chapter_count)
        : null,
    outlineRevisionCount: Number(data.outline_revision_count ?? 0),
    primaryRequirementFileId: data.primary_requirement_file_id
      ? String(data.primary_requirement_file_id)
      : null,
    latestOutlineVersionId: data.latest_outline_version_id
      ? String(data.latest_outline_version_id)
      : null,
    latestDraftVersionId: data.latest_draft_version_id
      ? String(data.latest_draft_version_id)
      : null,
    currentCandidateDraftId: data.current_candidate_draft_id
      ? String(data.current_candidate_draft_id)
      : null
  } satisfies TaskSummary;
}

function buildReferenceClosingSummary(referenceCount: number) {
  if (referenceCount === 0) {
    return "No references were available for checking.";
  }

  return `The report checks ${referenceCount} reference item(s) by comparing visible titles, dates, DOI or URL metadata, and claim alignment.`;
}

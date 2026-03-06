import type { OutlineScaffold, OutlineSection } from "@/src/lib/ai/prompts/generate-outline";
import { buildGenerateOutlinePrompt } from "@/src/lib/ai/prompts/generate-outline";
import { isMeaningfulOutline } from "@/src/lib/ai/outline-quality";
import { buildAnalyzeUploadedTaskRequirementsInstruction } from "@/src/lib/ai/prompts/analyze-uploaded-task";
import { requestOpenAITextResponse, safeParseJSON } from "@/src/lib/ai/openai-client";
import type { TaskAnalysisSnapshot } from "@/src/types/tasks";

export type ModelReadyTaskFile = {
  id: string;
  originalFilename: string;
  extractedText: string;
  contentType?: string;
  extractionMethod?: string;
  openaiFileId?: string | null;
  openaiUploadStatus?: "pending" | "uploaded" | "failed";
  rawBody?: Buffer | null;
};

type AnalyzeUploadedTaskInput = {
  files: ModelReadyTaskFile[];
  specialRequirements: string;
  forcedPrimaryFileId?: string | null;
  seedAnalysis?: TaskAnalysisSnapshot | null;
};

type AnalyzeUploadedTaskResult = {
  analysis: TaskAnalysisSnapshot;
  outline: OutlineScaffold | null;
};

type AnalyzeServiceError = Error & {
  code?: string;
  missingFields?: string[];
  partialAnalysis?: TaskAnalysisSnapshot;
};

type ParsedRequirements = Partial<TaskAnalysisSnapshot>;

type ParsedOutline = {
  articleTitle?: string;
  sections?: OutlineSection[];
};

const REQUIREMENTS_TEXT_FORMAT = {
  type: "json_schema",
  name: "task_requirements_result",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "chosenTaskFileId",
      "supportingFileIds",
      "ignoredFileIds",
      "needsUserConfirmation",
      "reasoning",
      "targetWordCount",
      "citationStyle",
      "topic",
      "chapterCount",
      "mustCover",
      "gradingFocus",
      "appliedSpecialRequirements",
      "usedDefaultWordCount",
      "usedDefaultCitationStyle",
      "warnings"
    ],
    properties: {
      chosenTaskFileId: { type: ["string", "null"] },
      supportingFileIds: { type: "array", items: { type: "string" } },
      ignoredFileIds: { type: "array", items: { type: "string" } },
      needsUserConfirmation: { type: "boolean" },
      reasoning: { type: "string" },
      targetWordCount: { type: "number" },
      citationStyle: { type: "string" },
      topic: { type: "string" },
      chapterCount: { type: ["number", "null"] },
      mustCover: { type: "array", items: { type: "string" } },
      gradingFocus: { type: "array", items: { type: "string" } },
      appliedSpecialRequirements: { type: "string" },
      usedDefaultWordCount: { type: "boolean" },
      usedDefaultCitationStyle: { type: "boolean" },
      warnings: { type: "array", items: { type: "string" } }
    }
  }
} as const;

const OUTLINE_TEXT_FORMAT = {
  type: "json_schema",
  name: "task_outline_result",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["articleTitle", "sections"],
    properties: {
      articleTitle: { type: "string" },
      sections: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "summary", "bulletPoints"],
          properties: {
            title: { type: "string" },
            summary: { type: "string" },
            bulletPoints: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      }
    }
  }
} as const;

export async function analyzeUploadedTaskWithOpenAI(
  input: AnalyzeUploadedTaskInput
): Promise<AnalyzeUploadedTaskResult> {
  ensureModelInputsReady(input.files);

  const seededAnalysis = canReuseSeedAnalysis(input.seedAnalysis, input.forcedPrimaryFileId)
    ? input.seedAnalysis
    : null;
  const requirements =
    seededAnalysis ??
    (await runRequirementsStage({
      files: input.files,
      specialRequirements: input.specialRequirements,
      forcedPrimaryFileId: input.forcedPrimaryFileId
    }));

  if (requirements.needsUserConfirmation) {
    return {
      analysis: requirements,
      outline: null
    };
  }

  try {
    const outline = await runOutlineStage({
      analysis: requirements,
      specialRequirements: input.specialRequirements
    });

    return {
      analysis: {
        ...requirements,
        topic: requirements.topic ?? outline.articleTitle
      },
      outline
    };
  } catch (error) {
    const normalized = error as AnalyzeServiceError;
    normalized.partialAnalysis = normalized.partialAnalysis ?? requirements;
    throw normalized;
  }
}

async function runRequirementsStage(input: {
  files: ModelReadyTaskFile[];
  specialRequirements: string;
  forcedPrimaryFileId?: string | null;
}) {
  const firstAttempt = await requestRequirementsAttempt(input);

  try {
    return normalizeAnalysis(firstAttempt, input);
  } catch (error) {
    if (!isRequirementsIncompleteError(error)) {
      throw error;
    }

    const secondAttempt = await requestRequirementsAttempt(input, firstAttempt.rawText);

    try {
      return normalizeAnalysis(secondAttempt, input);
    } catch (secondError) {
      if (!isRequirementsIncompleteError(secondError)) {
        throw secondError;
      }

      throw createModelAnalysisError(
        "MODEL_REQUIREMENTS_INCOMPLETE_AFTER_RETRY",
        secondError.missingFields
      );
    }
  }
}

async function runOutlineStage(input: {
  analysis: TaskAnalysisSnapshot;
  specialRequirements: string;
}) {
  const firstAttempt = await requestOutlineAttempt(input);

  try {
    return normalizeOutline(firstAttempt, input.analysis);
  } catch (error) {
    if (!isOutlineIncompleteError(error)) {
      throw error;
    }

    const secondAttempt = await requestOutlineAttempt(input, firstAttempt.rawText);

    try {
      return normalizeOutline(secondAttempt, input.analysis);
    } catch (secondError) {
      if (!isOutlineIncompleteError(secondError)) {
        throw secondError;
      }

      throw createModelAnalysisError(
        "MODEL_OUTLINE_INCOMPLETE_AFTER_RETRY",
        secondError.missingFields,
        input.analysis
      );
    }
  }
}

async function requestRequirementsAttempt(
  input: {
    files: ModelReadyTaskFile[];
    specialRequirements: string;
    forcedPrimaryFileId?: string | null;
  },
  previousRawText?: string
) {
  try {
    const response = await requestOpenAITextResponse({
      input: [
        {
          role: "user",
          content: buildRequirementsContent(input, previousRawText)
        }
      ],
      reasoningEffort: "medium",
      textFormat: REQUIREMENTS_TEXT_FORMAT as unknown as Record<string, unknown>
    });

    return {
      parsed: safeParseJSON<ParsedRequirements>(response.output_text),
      rawText: response.output_text
    };
  } catch (error) {
    throw mapOpenAIServiceError(error);
  }
}

async function requestOutlineAttempt(
  input: {
    analysis: TaskAnalysisSnapshot;
    specialRequirements: string;
  },
  previousRawText?: string
) {
  const prompt = buildGenerateOutlinePrompt({
    topic: input.analysis.topic || "Untitled Topic",
    targetWordCount: input.analysis.targetWordCount,
    citationStyle: input.analysis.citationStyle,
    chapterCountOverride: input.analysis.chapterCount,
    mustAnswer: input.analysis.mustCover,
    gradingPriorities: input.analysis.gradingFocus,
    specialRequirements: input.analysis.appliedSpecialRequirements || input.specialRequirements,
    feedback: previousRawText
      ? "The previous outline response was incomplete. Return a complete JSON outline with all required fields."
      : undefined
  });

  try {
    const response = await requestOpenAITextResponse({
      input: prompt,
      reasoningEffort: "medium",
      textFormat: OUTLINE_TEXT_FORMAT as unknown as Record<string, unknown>
    });

    return {
      parsed: safeParseJSON<ParsedOutline>(response.output_text),
      rawText: response.output_text
    };
  } catch (error) {
    throw mapOpenAIServiceError(error);
  }
}

function buildRequirementsContent(
  input: {
    files: ModelReadyTaskFile[];
    specialRequirements: string;
    forcedPrimaryFileId?: string | null;
  },
  previousRawText?: string
) {
  const content: Array<Record<string, unknown>> = [
    {
      type: "input_text",
      text: buildAnalyzeUploadedTaskRequirementsInstruction({
        specialRequirements: input.specialRequirements,
        forcedPrimaryFileId: input.forcedPrimaryFileId
      })
    }
  ];

  for (const file of input.files) {
    const shouldUsePdfFileInput = Boolean(file.openaiFileId && isPdfFile(file));
    const fileContextHeader = [
      `FILE_ID: ${file.id}`,
      `FILE_NAME: ${file.originalFilename}`
    ];

    if (shouldUsePdfFileInput) {
      content.push({
        type: "input_text",
        text: [
          ...fileContextHeader,
          "RAW_EXTRACTED_TEXT_OMITTED: Original PDF file is attached below. Read the PDF directly."
        ].join("\n")
      });
      content.push({
        type: "input_text",
        text: `PDF_FILE_CONTEXT: This PDF belongs to FILE_ID ${file.id} (${file.originalFilename}).`
      });
      content.push({
        type: "input_file",
        file_id: file.openaiFileId
      });
      continue;
    }

    content.push({
      type: "input_text",
      text: [
        ...fileContextHeader,
        "RAW_EXTRACTED_TEXT_START",
        file.extractedText || "(no extracted text available)",
        "RAW_EXTRACTED_TEXT_END"
      ].join("\n")
    });

    if (file.rawBody && isImageFile(file)) {
      content.push({
        type: "input_text",
        text: `IMAGE_FILE_CONTEXT: This image belongs to FILE_ID ${file.id} (${file.originalFilename}).`
      });
      content.push({
        type: "input_image",
        image_url: `data:${file.contentType || "image/png"};base64,${file.rawBody.toString("base64")}`
      });
    }
  }

  if (previousRawText) {
    content.push({
      type: "input_text",
      text: [
        "RETRY_INSTRUCTION:",
        "- Your previous requirements response was incomplete.",
        "- Return complete JSON with all required fields.",
        "- Do not omit required analysis fields.",
        "",
        "PREVIOUS_RESPONSE_SNIPPET_START",
        previousRawText.slice(0, 2400),
        "PREVIOUS_RESPONSE_SNIPPET_END"
      ].join("\n")
    });
  }

  return content;
}

function ensureModelInputsReady(files: ModelReadyTaskFile[]) {
  const brokenPdf = files.find((file) => {
    return isPdfTransportOnly(file) && !file.openaiFileId;
  });

  if (brokenPdf) {
    throw createModelAnalysisError("MODEL_INPUT_NOT_READY");
  }
}

function normalizeAnalysis(
  rawResponse: {
    parsed: ParsedRequirements | null;
    rawText: string;
  },
  input: {
    files: ModelReadyTaskFile[];
    specialRequirements: string;
    forcedPrimaryFileId?: string | null;
  }
): TaskAnalysisSnapshot {
  const raw = rawResponse.parsed;

  if (!raw) {
    throw createModelAnalysisError("MODEL_REQUIREMENTS_INCOMPLETE", ["analysis"]);
  }

  const validIds = new Set(input.files.map((file) => file.id));
  const chosenTaskFileId =
    typeof raw.chosenTaskFileId === "string" && validIds.has(raw.chosenTaskFileId)
      ? raw.chosenTaskFileId
      : input.forcedPrimaryFileId && validIds.has(input.forcedPrimaryFileId)
        ? input.forcedPrimaryFileId
        : null;

  const supportingFileIds = normalizeIds(raw.supportingFileIds, validIds).filter(
    (id) => id !== chosenTaskFileId
  );
  const ignoredFileIds = normalizeIds(raw.ignoredFileIds, validIds).filter(
    (id) => id !== chosenTaskFileId && !supportingFileIds.includes(id)
  );
  const targetWordCount =
    typeof raw.targetWordCount === "number" && raw.targetWordCount > 0
      ? Math.round(raw.targetWordCount)
      : null;
  const citationStyle =
    typeof raw.citationStyle === "string" && raw.citationStyle.trim()
      ? raw.citationStyle.trim()
      : null;
  const usedDefaultWordCount =
    typeof raw.usedDefaultWordCount === "boolean" ? raw.usedDefaultWordCount : null;
  const usedDefaultCitationStyle =
    typeof raw.usedDefaultCitationStyle === "boolean" ? raw.usedDefaultCitationStyle : null;

  const missingFields: string[] = [];
  if (targetWordCount === null) missingFields.push("targetWordCount");
  if (citationStyle === null) missingFields.push("citationStyle");
  if (usedDefaultWordCount === null) missingFields.push("usedDefaultWordCount");
  if (usedDefaultCitationStyle === null) missingFields.push("usedDefaultCitationStyle");

  if (missingFields.length > 0) {
    throw createModelAnalysisError("MODEL_REQUIREMENTS_INCOMPLETE", missingFields);
  }

  return {
    chosenTaskFileId,
    supportingFileIds,
    ignoredFileIds,
    needsUserConfirmation: Boolean(raw.needsUserConfirmation) || !chosenTaskFileId,
    reasoning:
      typeof raw.reasoning === "string" && raw.reasoning.trim()
        ? raw.reasoning.trim()
        : "The model analyzed the uploaded materials.",
    targetWordCount: targetWordCount as number,
    citationStyle: citationStyle as string,
    topic:
      typeof raw.topic === "string" && raw.topic.trim() ? raw.topic.trim() : null,
    chapterCount:
      typeof raw.chapterCount === "number" && raw.chapterCount > 0
        ? Math.round(raw.chapterCount)
        : null,
    mustCover: normalizeStrings(raw.mustCover),
    gradingFocus: normalizeStrings(raw.gradingFocus),
    appliedSpecialRequirements:
      typeof raw.appliedSpecialRequirements === "string"
        ? raw.appliedSpecialRequirements
        : input.specialRequirements,
    usedDefaultWordCount: usedDefaultWordCount as boolean,
    usedDefaultCitationStyle: usedDefaultCitationStyle as boolean,
    warnings: normalizeStrings(raw.warnings)
  };
}

function normalizeOutline(
  rawResponse: {
    parsed: ParsedOutline | null;
    rawText: string;
  },
  analysis: TaskAnalysisSnapshot
): OutlineScaffold {
  const raw = rawResponse.parsed;
  if (!raw?.articleTitle || !Array.isArray(raw.sections) || raw.sections.length === 0) {
    throw createModelAnalysisError("MODEL_OUTLINE_INCOMPLETE", ["outline"]);
  }

  const sections = raw.sections
    .map((section) => ({
      title: String(section.title ?? "").trim(),
      summary: String(section.summary ?? "").trim(),
      bulletPoints: Array.isArray(section.bulletPoints)
        ? section.bulletPoints.map((point) => String(point).trim()).filter(Boolean)
        : []
    }))
    .filter(
      (section) =>
        section.title &&
        section.summary &&
        section.bulletPoints.length > 0
    );

  if (sections.length === 0) {
    throw createModelAnalysisError("MODEL_OUTLINE_INCOMPLETE", ["sections"]);
  }

  const outline = {
    articleTitle: raw.articleTitle.trim(),
    targetWordCount: analysis.targetWordCount,
    citationStyle: analysis.citationStyle,
    sections,
    chineseMirrorPending: true,
    chineseMirror: null
  } satisfies OutlineScaffold;

  if (!isMeaningfulOutline(outline)) {
    throw createModelAnalysisError("MODEL_OUTLINE_INCOMPLETE", ["outline"]);
  }

  return outline;
}

function canReuseSeedAnalysis(
  analysis: TaskAnalysisSnapshot | null | undefined,
  forcedPrimaryFileId?: string | null
) {
  if (!analysis) {
    return false;
  }

  if (forcedPrimaryFileId && analysis.chosenTaskFileId !== forcedPrimaryFileId) {
    return false;
  }

  return true;
}

function isRequirementsIncompleteError(error: unknown): error is AnalyzeServiceError {
  const message = error instanceof Error ? error.message : String(error);
  return message === "MODEL_REQUIREMENTS_INCOMPLETE";
}

function isOutlineIncompleteError(error: unknown): error is AnalyzeServiceError {
  const message = error instanceof Error ? error.message : String(error);
  return message === "MODEL_OUTLINE_INCOMPLETE";
}

function mapOpenAIServiceError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message === "OpenAI request timed out") {
    return createModelAnalysisError("MODEL_ANALYSIS_TIMEOUT");
  }

  if (
    message.startsWith("OpenAI request failed with status") ||
    message.includes("fetch failed") ||
    message.includes("network")
  ) {
    return createModelAnalysisError("UPSTREAM_MODEL_UNAVAILABLE");
  }

  return error instanceof Error ? error : new Error(String(error));
}

function createModelAnalysisError(
  code: string,
  missingFields?: string[],
  partialAnalysis?: TaskAnalysisSnapshot
) {
  const error = new Error(code) as AnalyzeServiceError;
  error.code = code;
  if (missingFields?.length) {
    error.missingFields = missingFields;
  }
  if (partialAnalysis) {
    error.partialAnalysis = partialAnalysis;
  }
  return error;
}

function normalizeIds(value: unknown, validIds: Set<string>) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((item): item is string => typeof item === "string"))].filter(
    (id) => validIds.has(id)
  );
}

function normalizeStrings(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((item): item is string => typeof item === "string"))]
    .map((item) => item.trim())
    .filter(Boolean);
}

function isPdfTransportOnly(
  file: Pick<
    ModelReadyTaskFile,
    "originalFilename" | "contentType" | "extractionMethod" | "extractedText"
  >
) {
  return (
    (file.contentType === "application/pdf" ||
      file.originalFilename.toLowerCase().endsWith(".pdf")) &&
    (file.extractionMethod === "transport_only_pdf" ||
      file.extractedText.startsWith("[pdf transport-only:"))
  );
}

function isPdfFile(file: Pick<ModelReadyTaskFile, "originalFilename" | "contentType">) {
  return (
    file.contentType === "application/pdf" ||
    file.originalFilename.toLowerCase().endsWith(".pdf")
  );
}

function isImageFile(file: Pick<ModelReadyTaskFile, "originalFilename" | "contentType">) {
  if (file.contentType?.startsWith("image/")) {
    return true;
  }

  return /\.(png|jpe?g)$/i.test(file.originalFilename);
}

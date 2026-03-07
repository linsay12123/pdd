import type { OutlineScaffold, OutlineSection } from "@/src/lib/ai/prompts/generate-outline";
import { isMeaningfulOutline } from "@/src/lib/ai/outline-quality";
import { buildAnalyzeUploadedTaskInstruction } from "@/src/lib/ai/prompts/analyze-uploaded-task";
import { requestOpenAITextResponse, safeParseJSON } from "@/src/lib/ai/openai-client";
import type { TaskAnalysisSnapshot } from "@/src/types/tasks";

export const MODEL_RAW_RESPONSE_ONLY = "MODEL_RAW_RESPONSE_ONLY";

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

type ParsedAnalyzeResponse = {
  analysis?: ParsedRequirements | null;
  outline?: ParsedOutline | null;
};

const DEFAULT_TARGET_WORD_COUNT = 2000;
const DEFAULT_CITATION_STYLE = "APA 7";

const ANALYSIS_AND_OUTLINE_TEXT_FORMAT = {
  type: "json_schema",
  name: "task_analysis_and_outline_result",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["analysis", "outline"],
    properties: {
      analysis: {
        type: "object",
        additionalProperties: false,
        required: [
          "chosenTaskFileId",
          "supportingFileIds",
          "ignoredFileIds",
          "needsUserConfirmation",
          "reasoning",
          "topic",
          "chapterCount",
          "mustCover",
          "gradingFocus",
          "appliedSpecialRequirements",
          "warnings"
        ],
        properties: {
          chosenTaskFileId: { type: ["string", "null"] },
          supportingFileIds: { type: "array", items: { type: "string" } },
          ignoredFileIds: { type: "array", items: { type: "string" } },
          needsUserConfirmation: { type: "boolean" },
          reasoning: { type: "string" },
          targetWordCount: { type: ["number", "string", "null"] },
          citationStyle: { type: ["string", "null"] },
          topic: { type: "string" },
          chapterCount: { type: ["number", "null"] },
          mustCover: { type: "array", items: { type: "string" } },
          gradingFocus: { type: "array", items: { type: "string" } },
          appliedSpecialRequirements: { type: "string" },
          usedDefaultWordCount: { type: ["boolean", "string", "null"] },
          usedDefaultCitationStyle: { type: ["boolean", "string", "null"] },
          warnings: { type: "array", items: { type: "string" } }
        }
      },
      outline: {
        type: ["object", "null"],
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
    }
  }
} as const;

const RAW_FALLBACK_ERROR_CODES = new Set([
  "MODEL_REQUIREMENTS_INCOMPLETE",
  "MODEL_REQUIREMENTS_CONFLICTING",
  "MODEL_OUTLINE_INCOMPLETE",
  "MODEL_ANALYSIS_INCOMPLETE",
  "MODEL_RETURNED_EMPTY_OUTLINE"
]);

export async function analyzeUploadedTaskWithOpenAI(
  input: AnalyzeUploadedTaskInput
): Promise<AnalyzeUploadedTaskResult> {
  ensureModelInputsReady(input.files);

  const response = await requestStructuredAttempt(input);
  const parsed = response.parsed;

  let analysis: TaskAnalysisSnapshot;
  try {
    analysis = normalizeAnalysis(
      {
        parsed: parsed?.analysis ?? null,
        rawText: response.rawText
      },
      input
    );
  } catch (error) {
    if (!shouldUseRawFallback(error, response.rawText)) {
      throw error;
    }

    return {
      analysis: buildRawFallbackAnalysis({
        specialRequirements: input.specialRequirements,
        rawText: response.rawText,
        partialAnalysis: extractPartialAnalysis(error)
      }),
      outline: null
    };
  }

  if (analysis.needsUserConfirmation) {
    return {
      analysis: withStructuredRenderMeta(analysis),
      outline: null
    };
  }

  try {
    const outline = normalizeOutline(
      {
        parsed: parsed?.outline ?? null,
        rawText: response.rawText
      },
      analysis
    );

    return {
      analysis: withStructuredRenderMeta({
        ...analysis,
        topic: analysis.topic ?? outline.articleTitle
      }),
      outline
    };
  } catch (error) {
    if (!shouldUseRawFallback(error, response.rawText)) {
      const normalized = error as AnalyzeServiceError;
      normalized.partialAnalysis = normalized.partialAnalysis ?? analysis;
      throw normalized;
    }

    return {
      analysis: buildRawFallbackAnalysis({
        specialRequirements: input.specialRequirements,
        rawText: response.rawText,
        partialAnalysis: extractPartialAnalysis(error) ?? analysis
      }),
      outline: null
    };
  }
}

async function requestStructuredAttempt(input: {
  files: ModelReadyTaskFile[];
  specialRequirements: string;
  forcedPrimaryFileId?: string | null;
}) {
  try {
    const response = await requestOpenAITextResponse({
      input: [
        {
          role: "user",
          content: buildAnalyzeContent(input)
        }
      ],
      reasoningEffort: "medium",
      textFormat: ANALYSIS_AND_OUTLINE_TEXT_FORMAT as unknown as Record<string, unknown>
    });

    return {
      parsed: safeParseJSON<ParsedAnalyzeResponse>(response.output_text),
      rawText: response.output_text
    };
  } catch (error) {
    throw mapOpenAIServiceError(error);
  }
}

function buildAnalyzeContent(input: {
  files: ModelReadyTaskFile[];
  specialRequirements: string;
  forcedPrimaryFileId?: string | null;
}) {
  const content: Array<Record<string, unknown>> = [
    {
      type: "input_text",
      text: buildAnalyzeUploadedTaskInstruction({
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
  const explicitTargetWordCount = normalizePositiveInteger(raw.targetWordCount);
  const explicitCitationStyle = normalizeOptionalString(raw.citationStyle);
  const explicitDefaultWordCount = normalizeBoolean(raw.usedDefaultWordCount);
  const explicitDefaultCitationStyle = normalizeBoolean(raw.usedDefaultCitationStyle);
  const targetWordCount = explicitTargetWordCount ?? DEFAULT_TARGET_WORD_COUNT;
  const citationStyle = explicitCitationStyle ?? DEFAULT_CITATION_STYLE;
  const usedDefaultWordCount = explicitDefaultWordCount ?? explicitTargetWordCount === null;
  const usedDefaultCitationStyle =
    explicitDefaultCitationStyle ?? explicitCitationStyle === null;
  const partialAnalysis: TaskAnalysisSnapshot = {
    chosenTaskFileId,
    supportingFileIds,
    ignoredFileIds,
    needsUserConfirmation: Boolean(raw.needsUserConfirmation) || !chosenTaskFileId,
    reasoning:
      typeof raw.reasoning === "string" && raw.reasoning.trim()
        ? raw.reasoning.trim()
        : "The model analyzed the uploaded materials.",
    targetWordCount,
    citationStyle,
    topic: typeof raw.topic === "string" && raw.topic.trim() ? raw.topic.trim() : null,
    chapterCount: normalizePositiveInteger(raw.chapterCount),
    mustCover: normalizeStrings(raw.mustCover),
    gradingFocus: normalizeStrings(raw.gradingFocus),
    appliedSpecialRequirements:
      typeof raw.appliedSpecialRequirements === "string"
        ? raw.appliedSpecialRequirements
        : input.specialRequirements,
    usedDefaultWordCount,
    usedDefaultCitationStyle,
    warnings: normalizeStrings(raw.warnings),
    analysisRenderMode: "structured",
    rawModelResponse: null
  };

  const conflictFields: string[] = [];
  if (
    explicitTargetWordCount !== null &&
    explicitDefaultWordCount === true &&
    explicitTargetWordCount !== DEFAULT_TARGET_WORD_COUNT
  ) {
    conflictFields.push("usedDefaultWordCount");
  }
  if (
    explicitCitationStyle !== null &&
    explicitDefaultCitationStyle === true &&
    !isDefaultCitationStyle(explicitCitationStyle)
  ) {
    conflictFields.push("usedDefaultCitationStyle");
  }
  if (conflictFields.length > 0) {
    throw createModelAnalysisError(
      "MODEL_REQUIREMENTS_CONFLICTING",
      conflictFields,
      partialAnalysis
    );
  }

  const missingFields: string[] = [];
  if (!chosenTaskFileId && !Boolean(raw.needsUserConfirmation)) {
    missingFields.push("chosenTaskFileId");
  }
  if (!normalizeOptionalString(raw.topic) && normalizePositiveInteger(raw.chapterCount) === null) {
    missingFields.push("topic_or_chapterCount");
  }

  if (missingFields.length > 0) {
    throw createModelAnalysisError(
      "MODEL_REQUIREMENTS_INCOMPLETE",
      missingFields,
      partialAnalysis
    );
  }

  const warnings = [...partialAnalysis.warnings];
  if (explicitTargetWordCount === null) {
    warnings.push(
      "Program inferred the default 2000-word target because the model omitted a concrete targetWordCount."
    );
  }
  if (explicitCitationStyle === null) {
    warnings.push(
      "Program inferred APA 7 because the model omitted a concrete citationStyle."
    );
  }

  return {
    ...partialAnalysis,
    warnings
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
      (section) => section.title && section.summary && section.bulletPoints.length > 0
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

function withStructuredRenderMeta(analysis: TaskAnalysisSnapshot): TaskAnalysisSnapshot {
  return {
    ...analysis,
    analysisRenderMode: "structured",
    rawModelResponse: null
  };
}

function buildRawFallbackAnalysis(input: {
  specialRequirements: string;
  rawText: string;
  partialAnalysis?: TaskAnalysisSnapshot | null;
}): TaskAnalysisSnapshot {
  const partial = input.partialAnalysis;
  return {
    chosenTaskFileId: partial?.chosenTaskFileId ?? null,
    supportingFileIds: partial?.supportingFileIds ?? [],
    ignoredFileIds: partial?.ignoredFileIds ?? [],
    needsUserConfirmation: false,
    reasoning:
      partial?.reasoning?.trim() ||
      "The model returned readable content, but it did not form a formal outline payload.",
    targetWordCount: partial?.targetWordCount ?? DEFAULT_TARGET_WORD_COUNT,
    citationStyle: partial?.citationStyle ?? DEFAULT_CITATION_STYLE,
    topic: partial?.topic ?? null,
    chapterCount: partial?.chapterCount ?? null,
    mustCover: partial?.mustCover ?? [],
    gradingFocus: partial?.gradingFocus ?? [],
    appliedSpecialRequirements:
      partial?.appliedSpecialRequirements ?? input.specialRequirements,
    usedDefaultWordCount: partial?.usedDefaultWordCount ?? true,
    usedDefaultCitationStyle: partial?.usedDefaultCitationStyle ?? true,
    warnings: partial?.warnings ?? [],
    analysisRenderMode: "raw",
    rawModelResponse: input.rawText.trim()
  };
}

function extractPartialAnalysis(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "partialAnalysis" in error &&
    error.partialAnalysis &&
    typeof error.partialAnalysis === "object"
  ) {
    return error.partialAnalysis as TaskAnalysisSnapshot;
  }

  return null;
}

function shouldUseRawFallback(error: unknown, rawText: string) {
  if (!rawText.trim()) {
    return false;
  }

  const message = error instanceof Error ? error.message : String(error);
  return RAW_FALLBACK_ERROR_CODES.has(message);
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

function normalizePositiveInteger(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const normalized = Math.round(value);
    return normalized > 0 ? normalized : null;
  }

  if (typeof value === "string" && value.trim()) {
    const normalized = Number.parseInt(value.trim(), 10);
    return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
  }

  return null;
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "yes", "y", "1"].includes(normalized)) {
      return true;
    }
    if (["false", "no", "n", "0"].includes(normalized)) {
      return false;
    }
  }

  return null;
}

function isDefaultCitationStyle(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  return normalized === "apa 7" || normalized === "apa7" || normalized === "apa 7th";
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

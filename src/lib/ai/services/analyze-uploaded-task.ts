import type { OutlineScaffold, OutlineSection } from "@/src/lib/ai/prompts/generate-outline";
import { isMeaningfulOutline } from "@/src/lib/ai/outline-quality";
import { buildAnalyzeUploadedTaskInstruction } from "@/src/lib/ai/prompts/analyze-uploaded-task";
import { requestOpenAITextResponse, safeParseJSON } from "@/src/lib/ai/openai-client";
import type { TaskAnalysisSnapshot } from "@/src/types/tasks";

export type ModelReadyTaskFile = {
  id: string;
  originalFilename: string;
  extractedText: string;
  contentType?: string;
  openaiFileId?: string | null;
  rawBody?: Buffer | null;
};

type AnalyzeUploadedTaskInput = {
  files: ModelReadyTaskFile[];
  specialRequirements: string;
  forcedPrimaryFileId?: string | null;
};

type AnalyzeUploadedTaskResult = {
  analysis: TaskAnalysisSnapshot;
  outline: OutlineScaffold | null;
};

type AnalyzeAttemptDiagnostics = {
  attempt: 1 | 2;
  responseLength: number;
  repairedResponseLength: number | null;
  parseSource: "direct" | "repair" | "none";
};

type AnalyzeServiceError = Error & {
  code?: string;
  missingFields?: string[];
  diagnostics?: AnalyzeAttemptDiagnostics[];
};

const ANALYZE_TASK_TEXT_FORMAT = {
  type: "json_schema",
  name: "task_analysis_result",
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
          topic: { type: ["string", "null"] },
          chapterCount: { type: ["number", "null"] },
          mustCover: { type: "array", items: { type: "string" } },
          gradingFocus: { type: "array", items: { type: "string" } },
          appliedSpecialRequirements: { type: "string" },
          usedDefaultWordCount: { type: "boolean" },
          usedDefaultCitationStyle: { type: "boolean" },
          warnings: { type: "array", items: { type: "string" } }
        }
      },
      outline: {
        anyOf: [
          {
            type: "null"
          },
          {
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
                    bulletPoints: { type: "array", items: { type: "string" } }
                  }
                }
              }
            }
          }
        ]
      }
    }
  }
} as const;

type ParsedResult = {
  analysis?: Partial<TaskAnalysisSnapshot> | null;
  outline?: {
    articleTitle?: string;
    sections?: OutlineSection[];
  } | null;
};

export async function analyzeUploadedTaskWithOpenAI(
  input: AnalyzeUploadedTaskInput
): Promise<AnalyzeUploadedTaskResult> {
  const firstAttempt = await runAnalysisAttempt(input, 1);

  try {
    return normalizeAnalyzeUploadedTaskResult(input, firstAttempt.parsed);
  } catch (error) {
    if (!isRetryableModelAnalysisError(error)) {
      throw error;
    }

    const secondAttempt = await runAnalysisAttempt(input, 2, firstAttempt.rawText);

    try {
      return normalizeAnalyzeUploadedTaskResult(input, secondAttempt.parsed);
    } catch (secondError) {
      if (!isRetryableModelAnalysisError(secondError)) {
        throw secondError;
      }

      throw createModelAnalysisError(
        mapAfterRetryCode(secondError.message),
        secondError.missingFields,
        [firstAttempt.diagnostics, secondAttempt.diagnostics]
      );
    }
  }
}

function normalizeAnalyzeUploadedTaskResult(
  input: AnalyzeUploadedTaskInput,
  parsed: ParsedResult | null
) {
  const analysis = normalizeAnalysis(parsed?.analysis, input, parsed?.outline?.articleTitle);
  const outline = normalizeOutline(parsed?.outline, analysis);

  if (!analysis.needsUserConfirmation && !outline) {
    throw createModelAnalysisError("MODEL_RETURNED_EMPTY_OUTLINE");
  }

  return {
    analysis,
    outline
  };
}

async function runAnalysisAttempt(
  input: AnalyzeUploadedTaskInput,
  attempt: 1 | 2,
  previousRawText?: string
) {
  const response = await requestAnalysisResponse(
    buildAnalysisContent(input, {
      retry: attempt === 2,
      previousRawText
    })
  );
  const directParsed = parseAnalyzeUploadedTaskResult(response.output_text);
  const repaired = directParsed
    ? { parsed: directParsed, repairedText: null }
    : await repairAnalyzeUploadedTaskResult(response.output_text);
  const parsed = directParsed ?? repaired.parsed;

  return {
    rawText: response.output_text,
    parsed,
    diagnostics: {
      attempt,
      responseLength: response.output_text.length,
      repairedResponseLength: repaired.repairedText?.length ?? null,
      parseSource: directParsed ? "direct" : parsed ? "repair" : "none"
    } satisfies AnalyzeAttemptDiagnostics
  };
}

async function requestAnalysisResponse(inputContent: Array<Record<string, unknown>>) {
  try {
    return await requestOpenAITextResponse({
      input: [
        {
          role: "user",
          content: inputContent
        }
      ],
      reasoningEffort: "medium",
      textFormat: ANALYZE_TASK_TEXT_FORMAT as unknown as Record<string, unknown>
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("status 400")) {
      throw error;
    }

    return requestOpenAITextResponse({
      input: [
        {
          role: "user",
          content: inputContent
        }
      ],
      reasoningEffort: "medium"
    });
  }
}

function buildAnalysisContent(
  input: AnalyzeUploadedTaskInput,
  options?: {
    retry?: boolean;
    previousRawText?: string;
  }
) {
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
    } else {
      content.push({
        type: "input_text",
        text: [
          ...fileContextHeader,
          "RAW_EXTRACTED_TEXT_START",
          file.extractedText || "(no extracted text available)",
          "RAW_EXTRACTED_TEXT_END"
        ].join("\n")
      });
    }

    if (file.rawBody && isImageFile(file)) {
      content.push({
        type: "input_text",
        text: `IMAGE_FILE_CONTEXT: This image belongs to FILE_ID ${file.id} (${file.originalFilename}).`
      });
      content.push({
        type: "input_image",
        image_url: `data:${file.contentType || "image/png"};base64,${file.rawBody.toString("base64")}`
      });
    } else if (shouldUsePdfFileInput) {
      content.push({
        type: "input_text",
        text: `PDF_FILE_CONTEXT: This PDF belongs to FILE_ID ${file.id} (${file.originalFilename}).`
      });
      content.push({
        type: "input_file",
        file_id: file.openaiFileId
      });
    }
  }

  if (options?.retry) {
    content.push({
      type: "input_text",
      text: [
        "RETRY_INSTRUCTION:",
        "- Your previous response was incomplete or invalid for this workflow.",
        "- Return complete JSON with all required fields.",
        "- Do not omit any required analysis fields.",
        "- If you cannot determine a value, explicitly apply the instructed defaults.",
        "",
        "PREVIOUS_RESPONSE_SNIPPET_START",
        (options.previousRawText ?? "(empty)").slice(0, 2400),
        "PREVIOUS_RESPONSE_SNIPPET_END"
      ].join("\n")
    });
  }

  return content;
}

function parseAnalyzeUploadedTaskResult(text: string) {
  return safeParseJSON<ParsedResult>(text);
}

async function repairAnalyzeUploadedTaskResult(rawText: string) {
  try {
    const repairPrompt = [
      "Repair the following task analysis response into valid JSON.",
      "Return ONLY valid JSON.",
      "",
      "Required structure:",
      "{",
      '  "analysis": {',
      '    "chosenTaskFileId": "<string or null>",',
      '    "supportingFileIds": ["<string>"],',
      '    "ignoredFileIds": ["<string>"],',
      '    "needsUserConfirmation": <boolean>,',
      '    "reasoning": "<string>",',
      '    "targetWordCount": <number>,',
      '    "citationStyle": "<string>",',
      '    "topic": "<string>",',
      '    "chapterCount": <number or null>,',
      '    "mustCover": ["<string>"],',
      '    "gradingFocus": ["<string>"],',
      '    "appliedSpecialRequirements": "<string>",',
      '    "usedDefaultWordCount": <boolean>,',
      '    "usedDefaultCitationStyle": <boolean>,',
      '    "warnings": ["<string>"]',
      "  },",
      '  "outline": {',
      '    "articleTitle": "<string>",',
      '    "sections": [',
      '      { "title": "<string>", "summary": "<string>", "bulletPoints": ["<string>"] }',
      "    ]",
      "  } | null",
      "}",
      "",
      "RAW_RESPONSE:",
      rawText
    ].join("\n");

    const repaired = await requestOpenAITextResponse({
      input: repairPrompt,
      reasoningEffort: "low",
      textFormat: ANALYZE_TASK_TEXT_FORMAT as unknown as Record<string, unknown>
    });

    return {
      parsed: parseAnalyzeUploadedTaskResult(repaired.output_text),
      repairedText: repaired.output_text
    };
  } catch {
    return {
      parsed: null,
      repairedText: null
    };
  }
}

function normalizeAnalysis(
  raw: Partial<TaskAnalysisSnapshot> | null | undefined,
  input: AnalyzeUploadedTaskInput,
  outlineTitle?: string
): TaskAnalysisSnapshot {
  if (!raw) {
    throw createModelAnalysisError("MODEL_ANALYSIS_INCOMPLETE", ["analysis"]);
  }

  const validIds = new Set(input.files.map((file) => file.id));
  const chosenTaskFileId =
    typeof raw?.chosenTaskFileId === "string" && validIds.has(raw.chosenTaskFileId)
      ? raw.chosenTaskFileId
      : input.forcedPrimaryFileId && validIds.has(input.forcedPrimaryFileId)
        ? input.forcedPrimaryFileId
        : null;

  const supportingFileIds = normalizeIds(raw?.supportingFileIds, validIds).filter(
    (id) => id !== chosenTaskFileId
  );
  const ignoredFileIds = normalizeIds(raw?.ignoredFileIds, validIds).filter(
    (id) => id !== chosenTaskFileId && !supportingFileIds.includes(id)
  );
  const explicitWordCount =
    typeof raw?.targetWordCount === "number" && raw.targetWordCount > 0
      ? Math.round(raw.targetWordCount)
      : null;
  const explicitCitationStyle =
    typeof raw?.citationStyle === "string" && raw.citationStyle.trim()
      ? raw.citationStyle.trim()
      : null;
  const usedDefaultWordCount =
    typeof raw?.usedDefaultWordCount === "boolean" ? raw.usedDefaultWordCount : null;
  const usedDefaultCitationStyle =
    typeof raw?.usedDefaultCitationStyle === "boolean" ? raw.usedDefaultCitationStyle : null;

  const missingFields: string[] = [];
  if (explicitWordCount === null) missingFields.push("targetWordCount");
  if (explicitCitationStyle === null) missingFields.push("citationStyle");
  if (usedDefaultWordCount === null) missingFields.push("usedDefaultWordCount");
  if (usedDefaultCitationStyle === null) missingFields.push("usedDefaultCitationStyle");

  if (missingFields.length > 0) {
    throw createModelAnalysisError("MODEL_ANALYSIS_INCOMPLETE", missingFields);
  }

  const normalizedWordCount = explicitWordCount as number;
  const normalizedCitationStyle = explicitCitationStyle as string;
  const normalizedUsedDefaultWordCount = usedDefaultWordCount as boolean;
  const normalizedUsedDefaultCitationStyle = usedDefaultCitationStyle as boolean;

  return {
    chosenTaskFileId,
    supportingFileIds,
    ignoredFileIds,
    needsUserConfirmation: Boolean(raw?.needsUserConfirmation) || !chosenTaskFileId,
    reasoning:
      typeof raw?.reasoning === "string" && raw.reasoning.trim()
        ? raw.reasoning.trim()
        : "The model analyzed the uploaded materials.",
    targetWordCount: normalizedWordCount,
    citationStyle: normalizedCitationStyle,
    topic:
      typeof raw?.topic === "string" && raw.topic.trim()
        ? raw.topic.trim()
        : outlineTitle?.trim() || null,
    chapterCount:
      typeof raw?.chapterCount === "number" && raw.chapterCount > 0
        ? Math.round(raw.chapterCount)
        : null,
    mustCover: normalizeStrings(raw?.mustCover),
    gradingFocus: normalizeStrings(raw?.gradingFocus),
    appliedSpecialRequirements:
      typeof raw?.appliedSpecialRequirements === "string"
        ? raw.appliedSpecialRequirements
        : input.specialRequirements,
    usedDefaultWordCount: normalizedUsedDefaultWordCount,
    usedDefaultCitationStyle: normalizedUsedDefaultCitationStyle,
    warnings: normalizeStrings(raw?.warnings)
  };
}

function normalizeOutline(
  raw: ParsedResult["outline"],
  analysis: TaskAnalysisSnapshot
): OutlineScaffold | null {
  if (analysis.needsUserConfirmation) {
    return null;
  }

  if (
    !raw?.articleTitle ||
    !Array.isArray(raw.sections) ||
    raw.sections.length === 0
  ) {
    return null;
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
    return null;
  }

  const outline = {
    articleTitle: raw.articleTitle.trim(),
    targetWordCount: analysis.targetWordCount,
    citationStyle: analysis.citationStyle,
    sections,
    chineseMirrorPending: true,
    chineseMirror: null
  };

  return isMeaningfulOutline(outline) ? outline : null;
}

function isRetryableModelAnalysisError(error: unknown): error is AnalyzeServiceError {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message === "MODEL_ANALYSIS_INCOMPLETE" ||
    message === "MODEL_RETURNED_EMPTY_OUTLINE"
  );
}

function mapAfterRetryCode(code: string) {
  switch (code) {
    case "MODEL_ANALYSIS_INCOMPLETE":
      return "MODEL_ANALYSIS_INCOMPLETE_AFTER_RETRY";
    case "MODEL_RETURNED_EMPTY_OUTLINE":
      return "MODEL_RETURNED_EMPTY_OUTLINE_AFTER_RETRY";
    default:
      return code;
  }
}

function createModelAnalysisError(
  code: string,
  missingFields?: string[],
  diagnostics?: AnalyzeAttemptDiagnostics[]
) {
  const error = new Error(code) as AnalyzeServiceError;
  error.code = code;
  if (missingFields?.length) {
    error.missingFields = missingFields;
  }
  if (diagnostics?.length) {
    error.diagnostics = diagnostics;
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

  return [...new Set(value.filter((item): item is string => typeof item === "string"))].map(
    (item) => item.trim()
  ).filter(Boolean);
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

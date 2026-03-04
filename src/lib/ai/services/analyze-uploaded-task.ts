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
  const response = await requestOpenAITextResponse({
    input: [
      {
        role: "user",
        content: buildAnalysisContent(input)
      }
    ],
    reasoningEffort: "medium"
  });

  const parsed =
    parseAnalyzeUploadedTaskResult(response.output_text) ??
    (await repairAnalyzeUploadedTaskResult(response.output_text));

  const analysis = normalizeAnalysis(parsed?.analysis, input, parsed?.outline?.articleTitle);
  const outline = normalizeOutline(parsed?.outline, analysis);

  if (!analysis.needsUserConfirmation && !outline) {
    throw new Error("MODEL_RETURNED_EMPTY_OUTLINE");
  }

  return {
    analysis,
    outline
  };
}

function buildAnalysisContent(input: AnalyzeUploadedTaskInput) {
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
    content.push({
      type: "input_text",
      text: [
        `FILE_ID: ${file.id}`,
        `FILE_NAME: ${file.originalFilename}`,
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
    } else if (file.openaiFileId && isPdfFile(file)) {
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
      reasoningEffort: "low"
    });

    return parseAnalyzeUploadedTaskResult(repaired.output_text);
  } catch {
    return null;
  }
}

function normalizeAnalysis(
  raw: Partial<TaskAnalysisSnapshot> | null | undefined,
  input: AnalyzeUploadedTaskInput,
  outlineTitle?: string
): TaskAnalysisSnapshot {
  if (!raw) {
    throw new Error("MODEL_ANALYSIS_INCOMPLETE");
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

  if (
    explicitWordCount === null ||
    explicitCitationStyle === null ||
    usedDefaultWordCount === null ||
    usedDefaultCitationStyle === null
  ) {
    throw new Error("MODEL_ANALYSIS_INCOMPLETE");
  }

  return {
    chosenTaskFileId,
    supportingFileIds,
    ignoredFileIds,
    needsUserConfirmation: Boolean(raw?.needsUserConfirmation) || !chosenTaskFileId,
    reasoning:
      typeof raw?.reasoning === "string" && raw.reasoning.trim()
        ? raw.reasoning.trim()
        : "The model analyzed the uploaded materials.",
    targetWordCount: explicitWordCount,
    citationStyle: explicitCitationStyle,
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
    usedDefaultWordCount,
    usedDefaultCitationStyle,
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

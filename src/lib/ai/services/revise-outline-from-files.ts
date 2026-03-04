import type { OutlineScaffold, OutlineSection } from "@/src/lib/ai/prompts/generate-outline";
import { isMeaningfulOutline } from "@/src/lib/ai/outline-quality";
import { buildReviseOutlineInstruction } from "@/src/lib/ai/prompts/revise-outline-from-files";
import { requestOpenAITextResponse, safeParseJSON } from "@/src/lib/ai/openai-client";
import type { ModelReadyTaskFile } from "@/src/lib/ai/services/analyze-uploaded-task";
import type { TaskAnalysisSnapshot } from "@/src/types/tasks";

type ReviseOutlineFromFilesInput = {
  files: ModelReadyTaskFile[];
  analysis: TaskAnalysisSnapshot;
  previousOutline: OutlineScaffold | null;
  feedback: string;
};

export async function reviseOutlineFromFilesWithOpenAI(
  input: ReviseOutlineFromFilesInput
): Promise<OutlineScaffold> {
  const response = await requestOpenAITextResponse({
    input: [
      {
        role: "user",
        content: buildRevisionContent(input)
      }
    ],
    reasoningEffort: "medium"
  });

  const parsed =
    parseOutline(response.output_text) ??
    (await repairOutline(response.output_text));

  if (
    !parsed?.articleTitle ||
    !Array.isArray(parsed.sections) ||
    parsed.sections.length === 0
  ) {
    throw new Error("MODEL_RETURNED_EMPTY_OUTLINE");
  }

  const sections = parsed.sections
    .map((section) => ({
      title: String(section.title ?? "").trim(),
      summary: String(section.summary ?? "").trim(),
      bulletPoints: Array.isArray(section.bulletPoints)
        ? section.bulletPoints.map((point) => String(point).trim()).filter(Boolean)
        : []
    }))
    .filter((section) => section.title && section.summary && section.bulletPoints.length > 0);

  if (sections.length === 0) {
    throw new Error("MODEL_RETURNED_EMPTY_OUTLINE");
  }

  const outline = {
    articleTitle: parsed.articleTitle.trim(),
    targetWordCount: input.analysis.targetWordCount,
    citationStyle: input.analysis.citationStyle,
    sections,
    chineseMirrorPending: true,
    chineseMirror: null
  };

  if (!isMeaningfulOutline(outline)) {
    throw new Error("MODEL_RETURNED_INVALID_OUTLINE");
  }

  return outline;
}

function buildRevisionContent(input: ReviseOutlineFromFilesInput) {
  const content: Array<Record<string, unknown>> = [
    {
      type: "input_text",
      text: buildReviseOutlineInstruction({
        analysis: input.analysis,
        previousOutline: input.previousOutline,
        feedback: input.feedback
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

    if (file.rawBody && file.contentType?.startsWith("image/")) {
      content.push({
        type: "input_text",
        text: `IMAGE_FILE_CONTEXT: This image belongs to FILE_ID ${file.id} (${file.originalFilename}).`
      });
      content.push({
        type: "input_image",
        image_url: `data:${file.contentType};base64,${file.rawBody.toString("base64")}`
      });
    } else if (file.openaiFileId && file.originalFilename.toLowerCase().endsWith(".pdf")) {
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

function parseOutline(text: string) {
  return safeParseJSON<{
    articleTitle?: string;
    sections?: OutlineSection[];
  }>(text);
}

async function repairOutline(rawText: string) {
  try {
    const repaired = await requestOpenAITextResponse({
      input: [
        "Repair the following outline response into valid JSON.",
        "Return ONLY valid JSON with this structure:",
        "{",
        '  "articleTitle": "<string>",',
        '  "sections": [',
        '    { "title": "<string>", "summary": "<string>", "bulletPoints": ["<string>"] }',
        "  ]",
        "}",
        "",
        "RAW_RESPONSE:",
        rawText
      ].join("\n"),
      reasoningEffort: "low"
    });

    return parseOutline(repaired.output_text);
  } catch {
    return null;
  }
}

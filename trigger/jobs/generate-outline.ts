import {
  buildGenerateOutlinePrompt,
  buildOutlineScaffold,
  type GenerateOutlineInput,
  type OutlineScaffold,
  type OutlineSection
} from "@/src/lib/ai/prompts/generate-outline";
import {
  requestOpenAITextResponse,
  safeParseJSON
} from "@/src/lib/ai/openai-client";

export type { GenerateOutlineInput };

export async function generateOutlineForTask(
  input: GenerateOutlineInput
): Promise<OutlineScaffold> {
  try {
    const prompt = buildGenerateOutlinePrompt(input);
    const response = await requestOpenAITextResponse({
      input: prompt,
      reasoningEffort: "low"
    });
    const parsed = safeParseJSON<{
      articleTitle?: string;
      sections?: OutlineSection[];
    }>(response.output_text);

    if (
      !parsed?.articleTitle ||
      !Array.isArray(parsed.sections) ||
      parsed.sections.length === 0
    ) {
      console.warn("[generate-outline] GPT returned unparseable outline, using template fallback. Raw:", response.output_text.slice(0, 200));
      return buildOutlineScaffold(input);
    }

    const outline: OutlineScaffold = {
      articleTitle: parsed.articleTitle,
      targetWordCount: input.targetWordCount,
      citationStyle: input.citationStyle,
      sections: parsed.sections.map((section) => ({
        title: String(section.title ?? ""),
        summary: String(section.summary ?? ""),
        bulletPoints: Array.isArray(section.bulletPoints)
          ? section.bulletPoints.map(String)
          : []
      })),
      chineseMirrorPending: true,
      chineseMirror: null
    };

    const chineseMirror = await generateChineseMirror(outline);
    if (chineseMirror) {
      outline.chineseMirror = chineseMirror;
      outline.chineseMirrorPending = false;
    }

    return outline;
  } catch (error) {
    console.error("[generate-outline] GPT outline generation failed:", error instanceof Error ? error.message : error);
    return buildOutlineScaffold(input);
  }
}

async function generateChineseMirror(
  outline: OutlineScaffold
): Promise<{ articleTitle: string; sections: OutlineSection[] } | null> {
  try {
    const prompt = [
      "Translate the following academic article outline into Chinese.",
      "Return ONLY valid JSON (no markdown fences, no explanation).",
      "",
      "Required JSON structure:",
      "{",
      '  "articleTitle": "<中文标题>",',
      '  "sections": [',
      '    { "title": "<中文标题>", "summary": "<中文摘要>", "bulletPoints": ["<要点1>", "<要点2>"] }',
      "  ]",
      "}",
      "",
      "English outline to translate:",
      JSON.stringify({
        articleTitle: outline.articleTitle,
        sections: outline.sections
      })
    ].join("\n");

    const response = await requestOpenAITextResponse({
      input: prompt,
      reasoningEffort: "low"
    });
    const parsed = safeParseJSON<{
      articleTitle?: string;
      sections?: OutlineSection[];
    }>(response.output_text);

    if (
      !parsed?.articleTitle ||
      !Array.isArray(parsed.sections) ||
      parsed.sections.length === 0
    ) {
      return null;
    }

    return {
      articleTitle: parsed.articleTitle,
      sections: parsed.sections.map((section) => ({
        title: String(section.title ?? ""),
        summary: String(section.summary ?? ""),
        bulletPoints: Array.isArray(section.bulletPoints)
          ? section.bulletPoints.map(String)
          : []
      }))
    };
  } catch {
    return null;
  }
}

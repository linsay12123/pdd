import {
  defaultOpenAIModel,
  requestOpenAITextResponse
} from "@/src/lib/ai/openai-client";
import { buildGenerateDraftPrompt } from "@/src/lib/ai/prompts/generate-draft";
import type { OutlineScaffold } from "@/src/lib/ai/prompts/generate-outline";

type GenerateDraftInput = {
  outline: OutlineScaffold;
  specialRequirements?: string;
  requestText?: typeof requestOpenAITextResponse;
};

export async function generateDraftFromOutline({
  outline,
  specialRequirements,
  requestText = requestOpenAITextResponse
}: GenerateDraftInput) {
  const prompt = buildGenerateDraftPrompt({
    outline,
    specialRequirements
  });

  const sectionBlocks = outline.sections
    .map((section) => {
      return `## ${section.title}\n\n${section.summary}`;
    })
    .join("\n\n");

  const response = await requestText({
    input: prompt,
    model: defaultOpenAIModel,
    reasoningEffort: "high"
  });

  return {
    prompt,
    draft:
      response.output_text.trim() ||
      `# ${outline.articleTitle}\n\n${sectionBlocks}\n\nReferences\n\nReference list pending.`
  };
}

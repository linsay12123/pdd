import { buildGenerateDraftPrompt } from "@/src/lib/ai/prompts/generate-draft";
import type { OutlineScaffold } from "@/src/lib/ai/prompts/generate-outline";

type GenerateDraftInput = {
  outline: OutlineScaffold;
  specialRequirements?: string;
};

export async function generateDraftFromOutline({
  outline,
  specialRequirements
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

  return {
    prompt,
    draft: `# ${outline.articleTitle}\n\n${sectionBlocks}\n\nReferences\n\nReference list pending.`
  };
}

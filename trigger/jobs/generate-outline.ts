import {
  buildOutlineScaffold,
  type OutlineScaffold
} from "@/src/lib/ai/prompts/generate-outline";

type GenerateOutlineInput = {
  topic: string;
  targetWordCount: number;
  citationStyle: string;
  chapterCountOverride?: number | null;
  shorterOutline?: boolean;
};

export async function generateOutlineForTask(
  input: GenerateOutlineInput
): Promise<OutlineScaffold> {
  return buildOutlineScaffold(input);
}

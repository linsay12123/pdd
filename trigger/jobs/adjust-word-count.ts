import { buildAdjustWordCountPrompt } from "@/src/lib/ai/prompts/adjust-word-count";
import {
  applyCandidateDraft,
  countBodyWords
} from "@/src/lib/drafts/word-count";

type AdjustWordCountInput = {
  currentDraft: string;
  candidateDraft: string;
  targetWordCount: number;
};

export async function adjustDraftWordCount({
  currentDraft,
  candidateDraft,
  targetWordCount
}: AdjustWordCountInput) {
  const currentWordCount = countBodyWords(currentDraft);

  return {
    prompt: buildAdjustWordCountPrompt({
      draft: currentDraft,
      currentWordCount,
      targetWordCount
    }),
    ...applyCandidateDraft({
      currentDraft,
      candidateDraft,
      targetWordCount
    })
  };
}

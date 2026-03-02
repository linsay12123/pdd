import { buildVerifyReferencesPrompt } from "@/src/lib/ai/prompts/verify-references";
import { parseReferencesSection } from "@/src/lib/references/parse-references";
import {
  evaluateReferenceVerification,
  type ReferenceVerdict
} from "@/src/lib/references/verification-rules";

type VerifyReferencesInput = {
  draftMarkdown: string;
  claimText: string;
};

type ReferenceCheckResult = {
  rawReference: string;
  verdict: ReferenceVerdict;
  reasoning: string;
  prompt: string;
};

export async function verifyReferencesForDraft({
  draftMarkdown,
  claimText
}: VerifyReferencesInput): Promise<ReferenceCheckResult[]> {
  const entries = parseReferencesSection(draftMarkdown);

  return entries.map((entry) => {
    const prompt = buildVerifyReferencesPrompt({
      entry,
      claimText
    });

    const sourceCheck = {
      title: entry.detectedTitle ?? "",
      abstract: claimText,
      year: entry.detectedYear ?? "",
      doi: entry.detectedDoi ?? "",
      url: entry.detectedUrl ?? ""
    };

    const result = evaluateReferenceVerification({
      entry,
      sourceCheck,
      claimText
    });

    return {
      rawReference: entry.rawReference,
      verdict: result.verdict,
      reasoning: result.reasoning,
      prompt
    };
  });
}

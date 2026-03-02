import type { ParsedReferenceEntry } from "@/src/lib/references/parse-references";

type BuildVerifyReferencesPromptInput = {
  entry: ParsedReferenceEntry;
  claimText: string;
};

export function buildVerifyReferencesPrompt({
  entry,
  claimText
}: BuildVerifyReferencesPromptInput) {
  return [
    "Check whether this reference basically matches the claim being cited.",
    "Only use available metadata such as title, abstract, year, DOI, and URL.",
    "Do not claim full-text verification.",
    "Return either matching or risky with short reasoning.",
    "",
    `REFERENCE: ${entry.rawReference}`,
    `CLAIM: ${claimText}`
  ].join("\n");
}

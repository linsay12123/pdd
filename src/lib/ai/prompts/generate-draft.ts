import type { OutlineScaffold } from "./generate-outline";

type GenerateDraftPromptInput = {
  outline: OutlineScaffold;
  specialRequirements?: string;
};

export function buildGenerateDraftPrompt({
  outline,
  specialRequirements
}: GenerateDraftPromptInput) {
  const renderedSections = outline.sections
    .map((section) => {
      return [
        `SECTION: ${section.title}`,
        `SUMMARY: ${section.summary}`,
        `POINTS: ${section.bulletPoints.join("; ")}`
      ].join("\n");
    })
    .join("\n\n");

  return [
    "Write a full English academic article from the approved outline.",
    "The draft must include a title, clear section headings, third-person academic prose, and a References section.",
    "Do not output bullet lists in the final article body.",
    "",
    `TARGET_WORD_COUNT: ${outline.targetWordCount}`,
    `CITATION_STYLE: ${outline.citationStyle}`,
    `SPECIAL_REQUIREMENTS: ${specialRequirements || "(none)"}`,
    "",
    renderedSections
  ].join("\n");
}

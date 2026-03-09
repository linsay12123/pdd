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
    "write the entire article at once.",
    "write all these chapters in one complete response.",
    "The reasoning effort should be high. Think very hard and deep before writing.",
    "Make sure the answer is detailed, specific, comprehensive, and critically argued.",
    "Cut off all shallow talk.",
    "Write in paragraphs, no bullet point.",
    "This is supposed to be an critical argumentative discussion.",
    "Your discussion should support a clear thesis statement and every section should point back to that argument.",
    "Always provide specific detailed evidence to support the critical argument.",
    "Add critical academic thinking and consider multiple viewpoints instead of only describing them.",
    "Take a clear stand, but write in third person.",
    "Pick a side and have strong academic opinions, but keep the tone critical and academic in third person.",
    "Think step by step to re-structure the expression in sentences, avoid using “不是…而是..”句式, but do not change any meaning and do not miss any information.",
    "Do not Use straight quotation marks.",
    "Do not use em dash.",
    'Sentence structure do not use "dependent clause + independent clause with a comma" (dependent comma independent clauses).',
    "each references should come with proper link.",
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

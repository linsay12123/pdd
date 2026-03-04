import type { OutlineScaffold, OutlineSection } from "@/src/lib/ai/prompts/generate-outline";

const GENERIC_TITLE_PATTERNS = [
  /general academic essay/i,
  /a structured analysis/i
];

const PLACEHOLDER_SUMMARY_PATTERNS = [
  /will explain how .* develops in this section/i
];

const PLACEHOLDER_BULLET_PATTERNS = [
  /focus point\s*\d+/i
];

function isGenericTitle(title: string) {
  return GENERIC_TITLE_PATTERNS.some((pattern) => pattern.test(title));
}

function isPlaceholderSummary(summary: string) {
  return PLACEHOLDER_SUMMARY_PATTERNS.some((pattern) => pattern.test(summary));
}

function isPlaceholderBullet(point: string) {
  return PLACEHOLDER_BULLET_PATTERNS.some((pattern) => pattern.test(point));
}

export function isMeaningfulOutlineSection(section: OutlineSection) {
  return Boolean(
    section.title.trim() &&
      section.summary.trim() &&
      !isPlaceholderSummary(section.summary) &&
      Array.isArray(section.bulletPoints) &&
      section.bulletPoints.length > 0 &&
      section.bulletPoints.every((point) => point.trim() && !isPlaceholderBullet(point))
  );
}

export function isMeaningfulOutline(outline: Pick<OutlineScaffold, "articleTitle" | "sections">) {
  return Boolean(
    outline.articleTitle.trim() &&
      !isGenericTitle(outline.articleTitle) &&
      Array.isArray(outline.sections) &&
      outline.sections.length > 0 &&
      outline.sections.every(isMeaningfulOutlineSection)
  );
}

import { buildClassifyFilesPrompt } from "@/src/lib/ai/prompts/classify-files";
import { requestOpenAITextResponse } from "@/src/lib/ai/openai-client";

export type TaskFileCandidate = {
  id: string;
  originalFilename: string;
  extractedText: string;
};

export type FileClassificationResult = {
  primaryRequirementFileId: string | null;
  backgroundFileIds: string[];
  irrelevantFileIds: string[];
  needsUserConfirmation: boolean;
  reasoning: string;
};

export type PrimaryTaskHints = {
  explicitWordCount?: number;
  explicitCitationStyle?: string;
  topic?: string;
  chapterCountOverride?: number;
  mustAnswer?: string[];
  gradingPriorities?: string[];
};

const assignmentSignals = [
  /assignment/i,
  /assessment/i,
  /requirements?/i,
  /instructions?/i,
  /rubric/i,
  /required word count/i,
  /word count/i,
  /citation style/i,
  /use\s+(apa|harvard|mla|chicago)/i,
  /answer the following/i,
  /questions?/i
] as const;

const backgroundSignals = [
  /background/i,
  /industry/i,
  /market/i,
  /context/i,
  /case study/i,
  /reading/i,
  /report/i
] as const;

const irrelevantSignals = [
  /receipt/i,
  /invoice/i,
  /total/i,
  /amount due/i,
  /lunch/i,
  /tax/i
] as const;

function scoreSignals(text: string, patterns: readonly RegExp[]) {
  return patterns.reduce((total, pattern) => total + Number(pattern.test(text)), 0);
}

function dedupe(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function classifyFilesByHeuristics(
  files: TaskFileCandidate[]
): FileClassificationResult {
  const scoredFiles = files.map((file) => {
    const text = `${file.originalFilename}\n${file.extractedText}`;
    const assignmentScore = scoreSignals(text, assignmentSignals);
    const backgroundScore = scoreSignals(text, backgroundSignals);
    const irrelevantScore = scoreSignals(text, irrelevantSignals);

    return {
      ...file,
      assignmentScore,
      backgroundScore,
      irrelevantScore
    };
  });

  const requirementCandidates = scoredFiles.filter(
    (file) => file.assignmentScore >= 2
  );

  if (requirementCandidates.length > 1) {
    return {
      primaryRequirementFileId: null,
      backgroundFileIds: scoredFiles
        .filter((file) => file.irrelevantScore === 0)
        .map((file) => file.id),
      irrelevantFileIds: scoredFiles
        .filter((file) => file.irrelevantScore > 0)
        .map((file) => file.id),
      needsUserConfirmation: true,
      reasoning:
        "Multiple files contain strong assignment signals, so the system should ask the user to confirm the primary task file."
    };
  }

  const primaryRequirementFileId = requirementCandidates[0]?.id ?? null;
  const backgroundFileIds = scoredFiles
    .filter((file) => file.id !== primaryRequirementFileId && file.irrelevantScore === 0)
    .filter((file) => file.backgroundScore > 0 || file.assignmentScore > 0)
    .map((file) => file.id);
  const irrelevantFileIds = scoredFiles
    .filter(
      (file) =>
        file.id !== primaryRequirementFileId &&
        !backgroundFileIds.includes(file.id) &&
        file.irrelevantScore > 0
    )
    .map((file) => file.id);

  return {
    primaryRequirementFileId,
    backgroundFileIds,
    irrelevantFileIds,
    needsUserConfirmation: false,
    reasoning: primaryRequirementFileId
      ? "A single file contains the strongest assignment signals and is treated as the primary requirement file."
      : "No file had enough assignment signals, so the system should continue with defaults until stronger hints appear."
  };
}

export async function requestFileClassificationReview(files: TaskFileCandidate[]) {
  const prompt = buildClassifyFilesPrompt(files);
  return requestOpenAITextResponse({
    input: prompt
  });
}

function extractWordCount(text: string) {
  const patterns = [
    /required word count[:\s]+(\d{3,5})/i,
    /write\s+(\d{3,5})\s+words?/i,
    /(\d{3,5})\s+words?/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return Number(match[1]);
    }
  }

  return undefined;
}

function extractCitationStyle(text: string) {
  const styleMatch = text.match(
    /citation style[:\s]+([A-Za-z0-9 .-]{2,30}?)(?:[.\n]|$)/i
  );

  if (styleMatch) {
    return styleMatch[1].trim().replace(/[.]+$/, "");
  }

  const knownStyles = ["APA 7", "APA", "Harvard", "MLA", "Chicago"] as const;
  const foundStyle = knownStyles.find((style) =>
    new RegExp(style.replaceAll(" ", "\\s+"), "i").test(text)
  );

  return foundStyle;
}

function extractTopic(text: string) {
  const topicMatch = text.match(/topic[:\s]+([^\n.]{3,120})/i);
  return topicMatch?.[1]?.trim();
}

function extractChapterCount(text: string) {
  const match = text.match(/(\d+)\s+chapters?/i);
  return match ? Number(match[1]) : undefined;
}

function extractListAfterLabel(text: string, label: RegExp) {
  const match = text.match(label);
  if (!match?.[1]) {
    return [];
  }

  return dedupe(
    match[1]
      .split(/[;,]/)
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

export function extractPrimaryTaskHints(text: string): PrimaryTaskHints {
  return {
    explicitWordCount: extractWordCount(text),
    explicitCitationStyle: extractCitationStyle(text),
    topic: extractTopic(text),
    chapterCountOverride: extractChapterCount(text),
    mustAnswer: extractListAfterLabel(text, /must answer[:\s]+([^\n]+)/i),
    gradingPriorities: extractListAfterLabel(text, /grading priorities?[:\s]+([^\n]+)/i)
  };
}

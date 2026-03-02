type CandidatePromotionInput = {
  currentWordCount: number;
  candidateWordCount: number;
  targetWordCount: number;
  candidateHasTitle: boolean;
  candidateHasReferences: boolean;
};

type ApplyCandidateDraftInput = {
  currentDraft: string;
  candidateDraft: string;
  targetWordCount: number;
};

type ApplyCandidateDraftResult = {
  chosenDraft: string;
  currentWordCount: number;
  candidateWordCount: number;
  candidateWasPromoted: boolean;
};

function normalizeBodyMarkdown(markdown: string) {
  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`>-]/g, " ");
}

export function countBodyWords(markdown: string) {
  if (!markdown.trim()) {
    return 0;
  }

  const [body] = markdown.split(/^References$/m);
  const normalizedBody = normalizeBodyMarkdown(body ?? "");

  return normalizedBody
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function draftHasTitle(markdown: string) {
  return /^#\s+\S+/m.test(markdown);
}

export function draftHasReferences(markdown: string) {
  return /^References$/m.test(markdown);
}

export function shouldPromoteCandidateDraft({
  currentWordCount,
  candidateWordCount,
  targetWordCount,
  candidateHasTitle,
  candidateHasReferences
}: CandidatePromotionInput) {
  if (!candidateHasTitle || !candidateHasReferences) {
    return false;
  }

  const currentDistance = Math.abs(currentWordCount - targetWordCount);
  const candidateDistance = Math.abs(candidateWordCount - targetWordCount);

  return candidateDistance <= currentDistance;
}

export function applyCandidateDraft({
  currentDraft,
  candidateDraft,
  targetWordCount
}: ApplyCandidateDraftInput): ApplyCandidateDraftResult {
  const currentWordCount = countBodyWords(currentDraft);
  const candidateWordCount = countBodyWords(candidateDraft);
  const candidateWasPromoted = shouldPromoteCandidateDraft({
    currentWordCount,
    candidateWordCount,
    targetWordCount,
    candidateHasTitle: draftHasTitle(candidateDraft),
    candidateHasReferences: draftHasReferences(candidateDraft)
  });

  return {
    chosenDraft: candidateWasPromoted ? candidateDraft : currentDraft,
    currentWordCount,
    candidateWordCount,
    candidateWasPromoted
  };
}

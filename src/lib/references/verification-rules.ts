import type { ParsedReferenceEntry } from "./parse-references";

export type ReferenceVerdict = "matching" | "risky";

type ReferenceSourceCheck = {
  title: string;
  abstract: string;
  year: string;
  doi: string;
  url: string;
};

type EvaluateReferenceVerificationInput = {
  entry: ParsedReferenceEntry;
  sourceCheck: ReferenceSourceCheck;
  claimText: string;
};

type ReferenceVerificationResult = {
  verdict: ReferenceVerdict;
  reasoning: string;
};

function normalizeText(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function titlesAlign(entryTitle: string | undefined, sourceTitle: string) {
  const normalizedEntryTitle = normalizeText(entryTitle);
  const normalizedSourceTitle = normalizeText(sourceTitle);

  if (!normalizedEntryTitle || !normalizedSourceTitle) {
    return false;
  }

  return (
    normalizedEntryTitle === normalizedSourceTitle ||
    normalizedSourceTitle.includes(normalizedEntryTitle) ||
    normalizedEntryTitle.includes(normalizedSourceTitle)
  );
}

function claimLooksSupported(claimText: string, abstractText: string) {
  const claimWords = normalizeText(claimText)
    .split(/\W+/)
    .filter((word) => word.length >= 5);
  const abstract = normalizeText(abstractText);

  if (!claimWords.length || !abstract) {
    return false;
  }

  return claimWords.some((word) => abstract.includes(word));
}

function yearsConflict(entryYear: string | undefined, sourceYear: string) {
  return Boolean(entryYear && sourceYear && entryYear !== sourceYear);
}

function doiOrUrlConflict(entry: ParsedReferenceEntry, sourceCheck: ReferenceSourceCheck) {
  const normalizedEntryDoi = normalizeText(entry.detectedDoi);
  const normalizedSourceDoi = normalizeText(sourceCheck.doi);
  const normalizedEntryUrl = normalizeText(entry.detectedUrl);
  const normalizedSourceUrl = normalizeText(sourceCheck.url);

  if (normalizedEntryDoi && normalizedSourceDoi && normalizedEntryDoi !== normalizedSourceDoi) {
    return true;
  }

  if (
    normalizedEntryUrl &&
    normalizedSourceUrl &&
    normalizedEntryUrl !== normalizedSourceUrl &&
    !normalizedSourceUrl.includes(normalizedEntryUrl) &&
    !normalizedEntryUrl.includes(normalizedSourceUrl)
  ) {
    return true;
  }

  return false;
}

export function mapReferenceVerdictLabel(verdict: ReferenceVerdict) {
  return verdict === "matching" ? "基本可对应" : "有风险";
}

export function evaluateReferenceVerification({
  entry,
  sourceCheck,
  claimText
}: EvaluateReferenceVerificationInput): ReferenceVerificationResult {
  const hasCoreFields =
    Boolean(entry.detectedTitle) &&
    Boolean(sourceCheck.title) &&
    Boolean(sourceCheck.abstract);

  if (!hasCoreFields) {
    return {
      verdict: "risky",
      reasoning:
        "The reference is missing core fields such as title or abstract, so it cannot be matched confidently."
    };
  }

  if (yearsConflict(entry.detectedYear, sourceCheck.year)) {
    return {
      verdict: "risky",
      reasoning:
        "The publication year in the reference does not match the checked source details."
    };
  }

  if (doiOrUrlConflict(entry, sourceCheck)) {
    return {
      verdict: "risky",
      reasoning:
        "The DOI or source URL conflicts with the checked source details."
    };
  }

  if (!titlesAlign(entry.detectedTitle, sourceCheck.title)) {
    return {
      verdict: "risky",
      reasoning:
        "The reference title does not line up with the checked source title."
    };
  }

  if (!claimLooksSupported(claimText, sourceCheck.abstract)) {
    return {
      verdict: "risky",
      reasoning:
        "The checked abstract does not clearly support the specific claim being cited."
    };
  }

  return {
    verdict: "matching",
    reasoning:
      "The title, abstract, and available source metadata align with the claim, so this reference is treated as basically matching."
  };
}

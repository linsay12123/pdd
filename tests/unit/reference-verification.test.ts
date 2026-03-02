import { describe, expect, it } from "vitest";
import { parseReferencesSection } from "../../src/lib/references/parse-references";
import {
  evaluateReferenceVerification,
  mapReferenceVerdictLabel
} from "../../src/lib/references/verification-rules";

describe("reference parsing", () => {
  it("splits a references section into individual entries", () => {
    const entries = parseReferencesSection(
      [
        "References",
        "",
        "Smith, A. (2024). Clean energy transitions. Journal of Policy. https://doi.org/10.1000/test1",
        "",
        "Lee, B. (2023). Supply chain resilience. Global Review. https://example.com/paper"
      ].join("\n")
    );

    expect(entries).toHaveLength(2);
    expect(entries[0].detectedYear).toBe("2024");
    expect(entries[0].detectedDoi).toBe("10.1000/test1");
    expect(entries[1].detectedUrl).toBe("https://example.com/paper");
  });
});

describe("reference verification", () => {
  it("returns matching when title, abstract, year, and doi align", () => {
    const result = evaluateReferenceVerification({
      entry: {
        rawReference:
          "Smith, A. (2024). Clean energy transitions. Journal of Policy. https://doi.org/10.1000/test1",
        detectedTitle: "Clean energy transitions",
        detectedYear: "2024",
        detectedDoi: "10.1000/test1",
        detectedUrl: undefined
      },
      sourceCheck: {
        title: "Clean energy transitions",
        abstract:
          "This paper explains how clean energy transitions reshape industrial policy.",
        year: "2024",
        doi: "10.1000/test1",
        url: "https://doi.org/10.1000/test1"
      },
      claimText:
        "The article argues that clean energy transitions reshape industrial policy."
    });

    expect(result.verdict).toBe("matching");
    expect(mapReferenceVerdictLabel(result.verdict)).toBe("基本可对应");
  });

  it("returns risky when key fields are missing", () => {
    const result = evaluateReferenceVerification({
      entry: {
        rawReference: "Unknown source",
        detectedTitle: undefined,
        detectedYear: undefined,
        detectedDoi: undefined,
        detectedUrl: undefined
      },
      sourceCheck: {
        title: "",
        abstract: "",
        year: "",
        doi: "",
        url: ""
      },
      claimText: "A claim without a real source."
    });

    expect(result.verdict).toBe("risky");
    expect(mapReferenceVerdictLabel(result.verdict)).toBe("有风险");
  });

  it("returns risky when year or doi conflicts", () => {
    const result = evaluateReferenceVerification({
      entry: {
        rawReference:
          "Smith, A. (2024). Clean energy transitions. Journal of Policy. https://doi.org/10.1000/test1",
        detectedTitle: "Clean energy transitions",
        detectedYear: "2024",
        detectedDoi: "10.1000/test1",
        detectedUrl: undefined
      },
      sourceCheck: {
        title: "Clean energy transitions",
        abstract:
          "This paper explains how clean energy transitions reshape industrial policy.",
        year: "2022",
        doi: "10.1000/other",
        url: "https://doi.org/10.1000/other"
      },
      claimText:
        "The article argues that clean energy transitions reshape industrial policy."
    });

    expect(result.verdict).toBe("risky");
  });
});

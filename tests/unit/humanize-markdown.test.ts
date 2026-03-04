import { describe, expect, it } from "vitest";
import {
  buildHumanizeSubmission,
  rebuildDraftWithHumanizedBody,
  validateHumanizedBody
} from "../../src/lib/humanize/humanize-markdown";

describe("humanize markdown utilities", () => {
  const draft = `# Sample Title

## Introduction

Original opening paragraph.

## Analysis

Original analysis paragraph.

## References

Smith, A. (2024). Source.`;

  it("submits only the article body and leaves title and references outside the humanize payload", () => {
    const result = buildHumanizeSubmission(draft);

    expect(result.title).toBe("Sample Title");
    expect(result.sectionHeadings).toEqual(["Introduction", "Analysis"]);
    expect(result.references).toContain("Smith, A. (2024). Source.");
    expect(result.bodyForHumanize).toContain("Original opening paragraph.");
    expect(result.bodyForHumanize).toContain("Original analysis paragraph.");
    expect(result.bodyForHumanize).not.toContain("Sample Title");
    expect(result.bodyForHumanize).not.toContain("## Introduction");
    expect(result.bodyForHumanize).not.toContain("## References");
  });

  it("rebuilds the final markdown with the original title, headings, and references", () => {
    const submission = buildHumanizeSubmission(draft);

    const rebuilt = rebuildDraftWithHumanizedBody({
      original: submission,
      humanizedBody: submission.bodyForHumanize
        .replace("Original opening paragraph.", "Humanized opening paragraph.")
        .replace("Original analysis paragraph.", "Humanized analysis paragraph.")
    });

    expect(rebuilt).toContain("# Sample Title");
    expect(rebuilt).toContain("## Introduction");
    expect(rebuilt).toContain("Humanized opening paragraph.");
    expect(rebuilt).toContain("## Analysis");
    expect(rebuilt).toContain("Humanized analysis paragraph.");
    expect(rebuilt).toContain("## References");
    expect(rebuilt).toContain("Smith, A. (2024). Source.");
  });

  it("rejects empty or clearly broken humanized bodies before the system accepts them", () => {
    const submission = buildHumanizeSubmission(draft);

    expect(
      validateHumanizedBody({
        originalBody: submission.bodyForHumanize,
        humanizedBody: ""
      }).ok
    ).toBe(false);

    expect(
      validateHumanizedBody({
        originalBody: submission.bodyForHumanize,
        humanizedBody: submission.bodyForHumanize
      }).ok
    ).toBe(false);

    expect(
      validateHumanizedBody({
        originalBody: submission.bodyForHumanize,
        humanizedBody: "Too short"
      }).ok
    ).toBe(false);
  });
});

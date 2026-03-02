import { describe, expect, it } from "vitest";
import {
  classifyFilesByHeuristics,
  extractPrimaryTaskHints
} from "../../src/lib/ai/services/classify-files";
import { buildInitialRuleCard } from "../../src/lib/ai/services/build-rule-card";

describe("file classification", () => {
  it("picks a clear task requirement file when one file has the strongest assignment signals", () => {
    const result = classifyFilesByHeuristics([
      {
        id: "task-1",
        originalFilename: "assignment.docx",
        extractedText:
          "Assignment brief. Required word count: 1500 words. Use APA 7. Answer the following questions."
      },
      {
        id: "bg-1",
        originalFilename: "industry.pdf",
        extractedText:
          "Background reading about the industry and market conditions."
      },
      {
        id: "noise-1",
        originalFilename: "receipt.txt",
        extractedText: "Lunch total 12.50"
      }
    ]);

    expect(result.primaryRequirementFileId).toBe("task-1");
    expect(result.backgroundFileIds).toEqual(["bg-1"]);
    expect(result.irrelevantFileIds).toEqual(["noise-1"]);
    expect(result.needsUserConfirmation).toBe(false);
  });

  it("asks for user confirmation when multiple files look like assignment briefs", () => {
    const result = classifyFilesByHeuristics([
      {
        id: "task-1",
        originalFilename: "assignment-a.docx",
        extractedText: "Assignment brief. Required word count: 1800. Use Harvard."
      },
      {
        id: "task-2",
        originalFilename: "assignment-b.docx",
        extractedText: "Assessment requirements. Write 2000 words. Use APA 7."
      }
    ]);

    expect(result.primaryRequirementFileId).toBe(null);
    expect(result.needsUserConfirmation).toBe(true);
  });

  it("extracts the strongest explicit hints from a primary task file", () => {
    const hints = extractPrimaryTaskHints(
      "Required word count: 2200 words. Citation style: MLA. Topic: Renewable Energy Transition."
    );

    expect(hints.explicitWordCount).toBe(2200);
    expect(hints.explicitCitationStyle).toBe("MLA");
    expect(hints.topic).toBe("Renewable Energy Transition");
  });
});

describe("rule card building", () => {
  it("uses explicit task requirements before any fallback", () => {
    const ruleCard = buildInitialRuleCard({
      primaryTaskHints: {
        explicitWordCount: 1800,
        explicitCitationStyle: "Harvard",
        topic: "ESG Reporting"
      },
      backgroundHints: {
        suggestedWordCount: 3000,
        suggestedCitationStyle: "Chicago",
        topicHints: ["Generic background"]
      },
      userSpecialRequirements: "Focus on ASEAN manufacturing examples."
    });

    expect(ruleCard.targetWordCount).toBe(1800);
    expect(ruleCard.citationStyle).toBe("Harvard");
    expect(ruleCard.topic).toBe("ESG Reporting");
  });

  it("falls back to 2000 words and APA 7 when no explicit task requirement exists", () => {
    const ruleCard = buildInitialRuleCard({
      primaryTaskHints: {},
      backgroundHints: {},
      userSpecialRequirements: ""
    });

    expect(ruleCard.targetWordCount).toBe(2000);
    expect(ruleCard.citationStyle).toBe("APA 7");
  });

  it("keeps user special requirements in the first generated rule card", () => {
    const ruleCard = buildInitialRuleCard({
      primaryTaskHints: {
        topic: "Corporate Governance"
      },
      backgroundHints: {},
      userSpecialRequirements:
        "Prioritize postgraduate tone and add a Southeast Asia comparison."
    });

    expect(ruleCard.specialRequirements).toContain("Southeast Asia comparison");
  });
});

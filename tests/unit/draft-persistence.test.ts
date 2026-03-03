import { beforeEach, describe, expect, it } from "vitest";
import { countBodyWords } from "../../src/lib/drafts/word-count";
import {
  getTaskDraftVersion,
  getTaskSummary,
  listTaskDraftVersions,
  listTaskReferenceChecks,
  resetTaskDraftStore,
  resetTaskReferenceCheckStore,
  resetTaskStore,
  saveTaskSummary
} from "../../src/lib/tasks/repository";
import { saveDraftVersion } from "../../src/lib/tasks/save-draft-version";
import { saveReferenceChecks } from "../../src/lib/tasks/save-reference-checks";

describe("draft persistence", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    resetTaskStore();
    resetTaskDraftStore();
    resetTaskReferenceCheckStore();
  });

  it("stores an active draft with body-only word count and separated references", async () => {
    saveTaskSummary({
      id: "task-draft-1",
      userId: "user-1",
      status: "drafting",
      targetWordCount: 2000,
      citationStyle: "APA 7",
      specialRequirements: "",
      latestOutlineVersionId: "outline-1"
    });

    const draft = await saveDraftVersion({
      taskId: "task-draft-1",
      userId: "user-1",
      markdown: [
        "# Essay Title",
        "",
        "First body paragraph with analysis.",
        "",
        "Second body paragraph with evidence.",
        "",
        "References",
        "",
        "Smith, A. (2024). Example source."
      ].join("\n"),
      isActive: true,
      isCandidate: false
    });

    expect(draft.versionNumber).toBe(1);
    expect(draft.title).toBe("Essay Title");
    expect(draft.referencesMarkdown).toContain("Smith, A.");
    expect(draft.bodyWordCount).toBe(
      countBodyWords(
        [
          "# Essay Title",
          "",
          "First body paragraph with analysis.",
          "",
          "Second body paragraph with evidence.",
          "",
          "References",
          "",
          "Smith, A. (2024). Example source."
        ].join("\n")
      )
    );
    expect(getTaskSummary("task-draft-1")?.latestDraftVersionId).toBe(draft.id);
    expect(getTaskSummary("task-draft-1")?.currentCandidateDraftId).toBeNull();
  });

  it("tracks candidate drafts separately from the current adopted draft", async () => {
    saveTaskSummary({
      id: "task-draft-2",
      userId: "user-1",
      status: "adjusting_word_count",
      targetWordCount: 2000,
      citationStyle: "APA 7",
      specialRequirements: "",
      latestOutlineVersionId: "outline-1"
    });

    const activeDraft = await saveDraftVersion({
      taskId: "task-draft-2",
      userId: "user-1",
      markdown: "# Title\n\nBody one.\n\nReferences\n\nA source.",
      isActive: true,
      isCandidate: false
    });
    const candidateDraft = await saveDraftVersion({
      taskId: "task-draft-2",
      userId: "user-1",
      markdown: "# Title\n\nBody one. Body two.\n\nReferences\n\nA source.",
      isActive: false,
      isCandidate: true
    });

    expect(listTaskDraftVersions("task-draft-2")).toHaveLength(2);
    expect(getTaskDraftVersion("task-draft-2", activeDraft.id)?.isActive).toBe(true);
    expect(getTaskDraftVersion("task-draft-2", candidateDraft.id)?.isCandidate).toBe(true);
    expect(getTaskSummary("task-draft-2")?.latestDraftVersionId).toBe(activeDraft.id);
    expect(getTaskSummary("task-draft-2")?.currentCandidateDraftId).toBe(candidateDraft.id);
  });

  it("stores simple reference-check rows with verdict and reasoning", async () => {
    saveTaskSummary({
      id: "task-draft-3",
      userId: "user-1",
      status: "verifying_references",
      targetWordCount: 2000,
      citationStyle: "APA 7",
      specialRequirements: ""
    });

    const draft = await saveDraftVersion({
      taskId: "task-draft-3",
      userId: "user-1",
      markdown: "# Title\n\nBody one.\n\nReferences\n\nSmith, A. (2024). Example source.",
      isActive: true,
      isCandidate: false
    });

    const checks = await saveReferenceChecks({
      taskId: "task-draft-3",
      draftVersionId: draft.id,
      userId: "user-1",
      checks: [
        {
          rawReference: "Smith, A. (2024). Example source.",
          verdict: "matching",
          reasoning: "Title and abstract line up.",
          detectedTitle: "Example source",
          detectedYear: "2024",
          detectedDoi: "",
          detectedUrl: ""
        }
      ]
    });

    expect(checks).toHaveLength(1);
    expect(checks[0]?.verdict).toBe("matching");
    expect(checks[0]?.reasoning).toContain("line up");
    expect(listTaskReferenceChecks("task-draft-3")).toHaveLength(1);
  });
});

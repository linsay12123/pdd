import type { OutlineScaffold } from "@/src/lib/ai/prompts/generate-outline";
import type { TaskAnalysisSnapshot } from "@/src/types/tasks";

export function buildReviseOutlineInstruction(input: {
  analysis: TaskAnalysisSnapshot;
  previousOutline: OutlineScaffold | null;
  feedback: string;
}) {
  return [
    "You are revising an academic writing outline.",
    "Read the original task materials included in this request before revising the outline.",
    "The application has NOT interpreted the materials for you. Treat any extracted text as raw transport only.",
    "Return ONLY valid JSON with this exact structure:",
    "{",
    '  "articleTitle": "<English article title>",',
    '  "sections": [',
    '    {',
    '      "title": "<short English section title>",',
    '      "summary": "<English sentence explaining what this section will cover>",',
    '      "bulletPoints": ["<specific point>", "<specific point>"]',
    "    }",
    "  ]",
    "}",
    "",
    `CURRENT_ANALYSIS: ${JSON.stringify(input.analysis)}`,
    `PREVIOUS_OUTLINE: ${JSON.stringify(input.previousOutline)}`,
    `USER_REVISION_FEEDBACK: ${input.feedback}`,
    "",
    "Rules:",
    "- Follow USER_REVISION_FEEDBACK exactly as written.",
    "- Keep the outline aligned with the task requirements and special requirements from CURRENT_ANALYSIS.",
    "- TOPIC_SELECTION_POLICY:",
    "  1) If the task brief has an explicit fixed topic/direction, keep that topic fixed.",
    "  2) USER_REVISION_FEEDBACK can refine angle, structure, and emphasis, but must not override explicit fixed-topic requirements from the task brief.",
    "  3) If the brief is open or semi-open, prioritize user special requirements and USER_REVISION_FEEDBACK to refine topic focus.",
    "  4) If no concrete topic exists in both brief context and user inputs, propose one specific, arguable topic and clear writing scope.",
    "  5) Never output a generic placeholder topic/title.",
    "- If the user asks for a different chapter count, follow it if it does not conflict with explicit task-brief rules.",
    "- Every section must have a short title, a concrete summary, and specific bullet points.",
    "- Do not use placeholders such as 'focus point 1'.",
    "- All outline text must be in English."
  ].join("\n");
}

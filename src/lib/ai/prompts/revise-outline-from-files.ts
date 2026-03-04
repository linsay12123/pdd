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
    "- If the user asks for a different chapter count, follow it if it does not conflict with explicit task-brief rules.",
    "- Every section must have a short title, a concrete summary, and specific bullet points.",
    "- Do not use placeholders such as 'focus point 1'.",
    "- All outline text must be in English."
  ].join("\n");
}

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(__dirname, "../..");

describe("llm-driven workflow cleanup", () => {
  it("removes legacy heuristic and rule-card modules from the production codebase", () => {
    expect(
      existsSync(resolve(projectRoot, "src/lib/ai/services/classify-files.ts"))
    ).toBe(false);
    expect(
      existsSync(resolve(projectRoot, "src/lib/ai/services/build-rule-card.ts"))
    ).toBe(false);
    expect(
      existsSync(resolve(projectRoot, "src/lib/tasks/build-task-outline.ts"))
    ).toBe(false);
    expect(
      existsSync(resolve(projectRoot, "trigger/jobs/process-uploaded-task.ts"))
    ).toBe(false);
  });
});

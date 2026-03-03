import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workspaceDemoPagePath =
  "/Users/jeffo/Desktop/自动写作/.worktrees/bootstrap-shell/app/(app)/workspace/demo/page.tsx";
const outlinePlaceholderPath =
  "/Users/jeffo/Desktop/自动写作/.worktrees/bootstrap-shell/src/components/workspace/outline-review-panel.tsx";
const deliverablesPlaceholderPath =
  "/Users/jeffo/Desktop/自动写作/.worktrees/bootstrap-shell/src/components/workspace/deliverables-panel.tsx";

describe("workspace cleanup", () => {
  it("removes the old demo route and placeholder workspace panels", () => {
    expect(existsSync(workspaceDemoPagePath)).toBe(false);
    expect(existsSync(outlinePlaceholderPath)).toBe(false);
    expect(existsSync(deliverablesPlaceholderPath)).toBe(false);
  });
});

describe("workspace page source", () => {
  it("does not describe active workspace UI as placeholders", () => {
    const workspaceSource = readFileSync(
      "/Users/jeffo/Desktop/自动写作/.worktrees/bootstrap-shell/src/components/pages/workspace-page-client.tsx",
      "utf8"
    );

    expect(workspaceSource).not.toContain("占位");
    expect(workspaceSource).not.toContain("完整流程演示");
  });
});

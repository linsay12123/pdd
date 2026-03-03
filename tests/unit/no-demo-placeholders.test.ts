import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(__dirname, "../..");

const workspaceDemoPagePath =
  resolve(projectRoot, "app/(app)/workspace/demo/page.tsx");
const outlinePlaceholderPath =
  resolve(projectRoot, "src/components/workspace/outline-review-panel.tsx");
const deliverablesPlaceholderPath =
  resolve(projectRoot, "src/components/workspace/deliverables-panel.tsx");

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
      resolve(projectRoot, "src/components/pages/workspace-page-client.tsx"),
      "utf8"
    );

    expect(workspaceSource).not.toContain("占位");
    expect(workspaceSource).not.toContain("完整流程演示");
  });
});

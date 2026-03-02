import { describe, expect, it } from "vitest";
import {
  assertStatusTransition,
  canTransition,
  isTerminalTaskStatus
} from "../../src/lib/tasks/status-machine";

describe("task status machine", () => {
  it("allows valid transitions", () => {
    expect(canTransition("created", "quota_frozen")).toBe(true);
    expect(canTransition("quota_frozen", "extracting_files")).toBe(true);
    expect(canTransition("outline_ready", "awaiting_outline_approval")).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(canTransition("created", "drafting")).toBe(false);
    expect(() => assertStatusTransition("created", "drafting")).toThrow(
      "Invalid task status transition"
    );
  });

  it("treats failed and expired as terminal states", () => {
    expect(isTerminalTaskStatus("failed")).toBe(true);
    expect(isTerminalTaskStatus("expired")).toBe(true);
    expect(isTerminalTaskStatus("drafting")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  assertStatusTransition,
  canTransition,
  isTerminalTaskStatus
} from "../../src/lib/tasks/status-machine";

describe("task status machine", () => {
  it("allows valid transitions", () => {
    expect(canTransition("created", "awaiting_primary_file_confirmation")).toBe(true);
    expect(canTransition("created", "awaiting_outline_approval")).toBe(true);
    expect(canTransition("awaiting_primary_file_confirmation", "awaiting_outline_approval")).toBe(true);
    expect(canTransition("awaiting_outline_approval", "drafting")).toBe(true);
    expect(canTransition("deliverable_ready", "humanizing")).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(canTransition("created", "drafting")).toBe(false);
    expect(canTransition("awaiting_outline_approval", "created")).toBe(false);
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

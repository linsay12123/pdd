import { describe, expect, it } from "vitest";
import { buildSafetyIdentifier } from "../../src/lib/ai/safety-identifier";

describe("safety identifier", () => {
  it("builds a stable hashed identifier from the current user id", () => {
    const first = buildSafetyIdentifier("user-123");
    const second = buildSafetyIdentifier("user-123");

    expect(first).toBe(second);
    expect(first).toMatch(/^pdd_[a-f0-9]{24}$/);
    expect(first).not.toContain("user-123");
  });
});

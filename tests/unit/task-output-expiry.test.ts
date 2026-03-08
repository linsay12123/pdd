import { describe, expect, it } from "vitest";
import {
  TASK_OUTPUT_TTL_DAYS,
  isTaskOutputExpired,
  resolveTaskOutputExpiresAt
} from "../../src/lib/tasks/task-output-expiry";

describe("task output expiry helpers", () => {
  it("uses a valid explicit expiresAt as the single source of truth", () => {
    expect(
      resolveTaskOutputExpiresAt({
        createdAt: "2026-03-03T10:00:00.000Z",
        expiresAt: "2026-03-06T10:00:00.000Z"
      })
    ).toBe("2026-03-06T10:00:00.000Z");
    expect(TASK_OUTPUT_TTL_DAYS).toBe(3);
  });

  it("derives expiresAt from createdAt when the row still has no stored expiry", () => {
    expect(
      resolveTaskOutputExpiresAt({
        createdAt: "2026-03-03T10:00:00.000Z",
        expiresAt: null
      })
    ).toBe("2026-03-06T10:00:00.000Z");
  });

  it("throws when createdAt is invalid instead of falling back to Date.now", () => {
    expect(() =>
      resolveTaskOutputExpiresAt({
        createdAt: "not-a-real-date",
        expiresAt: null
      })
    ).toThrow("Task output createdAt is invalid");
  });

  it("throws when explicit expiresAt is invalid", () => {
    expect(() =>
      resolveTaskOutputExpiresAt({
        createdAt: "2026-03-03T10:00:00.000Z",
        expiresAt: "still-not-a-date"
      })
    ).toThrow("Task output expiresAt is invalid");
  });

  it("uses one numeric expiry rule everywhere", () => {
    expect(
      isTaskOutputExpired({
        expiresAt: "2026-03-06T10:00:00.000Z",
        now: "2026-03-06T09:59:59.000Z"
      })
    ).toBe(false);
    expect(
      isTaskOutputExpired({
        expiresAt: "2026-03-06T10:00:00.000Z",
        now: "2026-03-06T10:00:00.000Z"
      })
    ).toBe(true);
  });
});

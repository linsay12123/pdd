import { describe, expect, it } from "vitest";
import { isProtectedPath } from "../../proxy";

describe("isProtectedPath", () => {
  it("marks app routes as protected", () => {
    expect(isProtectedPath("/workspace")).toBe(true);
    expect(isProtectedPath("/tasks")).toBe(true);
    expect(isProtectedPath("/billing")).toBe(true);
    expect(isProtectedPath("/recharge")).toBe(true);
    expect(isProtectedPath("/account")).toBe(true);
    expect(isProtectedPath("/admin")).toBe(true);
  });

  it("leaves public routes open", () => {
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/login")).toBe(false);
  });
});

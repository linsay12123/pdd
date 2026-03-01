import { describe, expect, it } from "vitest";
import HomePage from "../../app/page";

describe("HomePage", () => {
  it("exports the workspace entry page", () => {
    expect(HomePage).toBeTypeOf("function");
  });
});

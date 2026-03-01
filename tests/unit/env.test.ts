import { describe, expect, it } from "vitest";
import { env } from "../../src/config/env";

describe("env", () => {
  it("exposes the required platform keys as strings", () => {
    expect(env.OPENAI_API_KEY).toBeTypeOf("string");
    expect(env.STEALTHGPT_API_KEY).toBeTypeOf("string");
    expect(env.STRIPE_SECRET_KEY).toBeTypeOf("string");
  });
});

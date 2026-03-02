import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("brand assets", () => {
  it("stores the pindaidai logo and sales qr code in the main app public folder", () => {
    expect(existsSync(join(process.cwd(), "public", "logo.jpg"))).toBe(true);
    expect(existsSync(join(process.cwd(), "public", "qrcode.jpg"))).toBe(true);
  });
});

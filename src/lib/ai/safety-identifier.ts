import crypto from "node:crypto";

export function buildSafetyIdentifier(userId: string) {
  return `pdd_${crypto.createHash("sha256").update(userId, "utf8").digest("hex").slice(0, 24)}`;
}

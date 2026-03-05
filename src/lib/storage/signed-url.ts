import crypto from "node:crypto";
import type { TaskOutputRecord } from "@/src/types/tasks";

const DEFAULT_SIGNED_URL_TTL_SECONDS = 15 * 60;

export function createDownloadSignature({
  userId,
  storagePath,
  expiresAt,
  urlExpiresAt
}: {
  userId: string;
  storagePath: string;
  expiresAt: string;
  urlExpiresAt: string;
}) {
  const signingSecret = getDownloadSigningSecret();
  return crypto
    .createHmac("sha256", signingSecret)
    .update(`${userId}:${storagePath}:${expiresAt}:${urlExpiresAt}`, "utf8")
    .digest("hex")
    .slice(0, 24);
}

export function createSignedDownloadUrl({
  output,
  userId
}: {
  output: TaskOutputRecord;
  userId: string;
}) {
  if (output.expired) {
    throw new Error("This file has expired");
  }

  if (!verifyOutputOwnership(output, userId)) {
    throw new Error("You do not have access to this file");
  }

  const urlExpiresAt = resolveDownloadUrlExpiresAt(output.expiresAt);
  const signature = createDownloadSignature({
    userId,
    storagePath: output.storagePath,
    expiresAt: output.expiresAt,
    urlExpiresAt
  });

  const encodedPath = encodeURIComponent(output.storagePath);
  const encodedExpiresAt = encodeURIComponent(urlExpiresAt);

  return `/api/storage/download?path=${encodedPath}&expires=${encodedExpiresAt}&signature=${signature}`;
}

export function verifyOutputOwnership(output: TaskOutputRecord, userId: string) {
  return output.storagePath.startsWith(`users/${userId}/`);
}

function resolveDownloadUrlExpiresAt(outputExpiresAt: string) {
  const now = Date.now();
  const outputExpiryMs = Date.parse(outputExpiresAt);
  if (Number.isNaN(outputExpiryMs)) {
    throw new Error("Output expiry time is invalid");
  }

  const signedUrlExpiryMs = Math.min(outputExpiryMs, now + DEFAULT_SIGNED_URL_TTL_SECONDS * 1000);
  return new Date(signedUrlExpiryMs).toISOString();
}

function getDownloadSigningSecret() {
  const explicitSecret = process.env.DOWNLOAD_SIGNING_SECRET?.trim();
  if (explicitSecret) {
    return explicitSecret;
  }

  const fallbackSecret =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? process.env.NEXTAUTH_SECRET?.trim() ?? "";
  if (fallbackSecret) {
    return fallbackSecret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("DOWNLOAD_SIGNING_SECRET_MISSING");
  }

  return "local-dev-download-signing-secret";
}

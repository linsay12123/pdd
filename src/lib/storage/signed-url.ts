import crypto from "node:crypto";
import type { TaskOutputRecord } from "@/src/types/tasks";

export function createDownloadSignature({
  userId,
  storagePath,
  expiresAt
}: {
  userId: string;
  storagePath: string;
  expiresAt: string;
}) {
  return crypto
    .createHash("sha256")
    .update(`${userId}:${storagePath}:${expiresAt}`, "utf8")
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

  const signature = createDownloadSignature({
    userId,
    storagePath: output.storagePath,
    expiresAt: output.expiresAt
  });

  const encodedPath = encodeURIComponent(output.storagePath);

  return `/api/storage/download?path=${encodedPath}&signature=${signature}`;
}

export function verifyOutputOwnership(output: TaskOutputRecord, userId: string) {
  return output.storagePath.startsWith(`users/${userId}/`);
}

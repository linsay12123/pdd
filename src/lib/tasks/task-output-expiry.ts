export const TASK_OUTPUT_TTL_DAYS = 3;
export const TASK_OUTPUT_TTL_MS = TASK_OUTPUT_TTL_DAYS * 24 * 60 * 60 * 1000;

export function resolveTaskOutputExpiresAt(input: {
  createdAt: string;
  expiresAt?: string | null;
}) {
  const explicitExpiresAt = input.expiresAt?.trim();
  if (explicitExpiresAt) {
    return toNormalizedIso(explicitExpiresAt, "Task output expiresAt");
  }

  const createdAtMs = toTimestamp(input.createdAt, "Task output createdAt");
  return new Date(createdAtMs + TASK_OUTPUT_TTL_MS).toISOString();
}

export function isTaskOutputExpired(input: {
  expiresAt: string;
  now?: string;
}) {
  const expiresAtMs = toTimestamp(input.expiresAt, "Task output expiresAt");
  const nowMs = toTimestamp(input.now ?? new Date().toISOString(), "Task output now");
  return nowMs >= expiresAtMs;
}

function toNormalizedIso(value: string, label: string) {
  return new Date(toTimestamp(value, label)).toISOString();
}

function toTimestamp(value: string, label: string) {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`${label} is invalid`);
  }

  return parsed;
}

const TASK_OUTPUT_TTL_MS = 3 * 24 * 60 * 60 * 1000;

export function resolveTaskOutputExpiresAt(input: {
  createdAt: string;
  expiresAt?: string | null;
}) {
  const explicitExpiresAt = input.expiresAt?.trim();
  if (explicitExpiresAt) {
    return explicitExpiresAt;
  }

  const createdAtMs = Date.parse(input.createdAt);
  if (!Number.isNaN(createdAtMs)) {
    return new Date(createdAtMs + TASK_OUTPUT_TTL_MS).toISOString();
  }

  return new Date(Date.now() + TASK_OUTPUT_TTL_MS).toISOString();
}

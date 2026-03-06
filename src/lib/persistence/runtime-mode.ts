export function shouldUseSupabasePersistence() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
}

export function shouldUseLocalTestPersistence() {
  if (shouldUseSupabasePersistence()) {
    return false;
  }

  return process.env.NODE_ENV === "test";
}

export function requireFormalPersistence(): never {
  throw new Error("REAL_PERSISTENCE_REQUIRED");
}

export function requireFormalArtifactStorage(): never {
  throw new Error("REAL_ARTIFACT_STORAGE_REQUIRED");
}

export function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

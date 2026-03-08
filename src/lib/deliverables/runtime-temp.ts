import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export async function withRuntimeTempDir<T>(
  prefix: string,
  work: (tempDir: string) => Promise<T>
) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), prefix));

  try {
    return await work(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch((error: unknown) => {
      console.warn(
        "[deliverables] failed to clean temp dir:",
        error instanceof Error ? error.message : String(error)
      );
    });
  }
}

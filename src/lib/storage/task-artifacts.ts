import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  requireFormalArtifactStorage,
  shouldUseLocalTestPersistence,
  shouldUseSupabasePersistence
} from "@/src/lib/persistence/runtime-mode";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { resolveStoredFileDiskPath } from "@/src/lib/storage/task-output-files";

export const taskArtifactBucket = "task-artifacts";

type SaveTaskArtifactInput = {
  storagePath: string;
  body: Buffer;
  contentType: string;
};

type ReadTaskArtifactInput = {
  storagePath: string;
};

type DeleteTaskArtifactInput = {
  storagePath: string;
};

export async function saveTaskArtifact(input: SaveTaskArtifactInput) {
  if (!shouldUseSupabasePersistence()) {
    if (!shouldUseLocalTestPersistence()) {
      requireFormalArtifactStorage();
    }

    const outputPath = resolveStoredFileDiskPath(input.storagePath);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, input.body);
    return {
      mode: "local" as const,
      outputPath
    };
  }

  const client = createSupabaseAdminClient();
  const { error } = await client.storage
    .from(taskArtifactBucket)
    .upload(input.storagePath, input.body, {
      contentType: input.contentType,
      upsert: true
    });

  if (error) {
    throw new Error(`上传交付文件失败：${error.message}`);
  }

  return {
    mode: "supabase" as const,
    outputPath: input.storagePath
  };
}

export async function readTaskArtifact(input: ReadTaskArtifactInput) {
  if (!shouldUseSupabasePersistence()) {
    if (!shouldUseLocalTestPersistence()) {
      requireFormalArtifactStorage();
    }

    return readFile(resolveStoredFileDiskPath(input.storagePath));
  }

  const client = createSupabaseAdminClient();
  const { data, error } = await client.storage
    .from(taskArtifactBucket)
    .download(input.storagePath);

  if (error || !data) {
    throw new Error(`读取交付文件失败：${error?.message ?? "文件不存在"}`);
  }

  return Buffer.from(await data.arrayBuffer());
}

export async function deleteTaskArtifact(input: DeleteTaskArtifactInput) {
  if (!shouldUseSupabasePersistence()) {
    if (!shouldUseLocalTestPersistence()) {
      requireFormalArtifactStorage();
    }

    await rm(resolveStoredFileDiskPath(input.storagePath), {
      force: true
    });
    return;
  }

  const client = createSupabaseAdminClient();
  const { error } = await client.storage
    .from(taskArtifactBucket)
    .remove([input.storagePath]);

  if (error && !String(error.message ?? "").toLowerCase().includes("not found")) {
    throw new Error(`删除交付文件失败：${error.message}`);
  }
}

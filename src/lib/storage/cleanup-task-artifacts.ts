import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { taskArtifactBucket } from "@/src/lib/storage/task-artifacts";

const TERMINAL_TASK_STATUSES = ["deliverable_ready", "failed", "expired"] as const;
const DEFAULT_UPLOAD_RETENTION_DAYS = 3;
const DEFAULT_CLEANUP_LIMIT = 200;

type CleanupTaskArtifactsInput = {
  limit?: number;
  uploadRetentionDays?: number;
};

type OutputCandidate = {
  id: string;
  userId: string;
  storagePath: string;
};

type UploadCandidate = {
  id: string;
  userId: string;
  taskId: string;
  storagePath: string;
};

type CleanupTaskArtifactsDependencies = {
  isPersistenceReady?: () => boolean;
  listOutputCandidates?: (input: {
    limit: number;
    nowIso: string;
  }) => Promise<OutputCandidate[]>;
  listUploadCandidates?: (input: {
    limit: number;
    cutoffIso: string;
  }) => Promise<UploadCandidate[]>;
  deleteStorageObject?: (
    storagePath: string
  ) => Promise<{ ok: boolean; reason?: string }>;
  deleteOutputRecord?: (id: string, userId: string) => Promise<void>;
  deleteUploadRecord?: (id: string, userId: string) => Promise<void>;
};

export type CleanupTaskArtifactsResult = {
  skipped: boolean;
  reason?: string;
  scannedOutputs: number;
  scannedUploads: number;
  deletedOutputs: number;
  deletedUploads: number;
  failed: number;
  failureSamples: string[];
};

export async function cleanupTaskArtifacts(
  input: CleanupTaskArtifactsInput = {},
  dependencies: CleanupTaskArtifactsDependencies = {}
): Promise<CleanupTaskArtifactsResult> {
  if (!(dependencies.isPersistenceReady ?? shouldUseSupabasePersistence)()) {
    return {
      skipped: true,
      reason: "REAL_PERSISTENCE_REQUIRED",
      scannedOutputs: 0,
      scannedUploads: 0,
      deletedOutputs: 0,
      deletedUploads: 0,
      failed: 0,
      failureSamples: []
    };
  }

  const limit = Math.max(1, Math.min(DEFAULT_CLEANUP_LIMIT, input.limit ?? DEFAULT_CLEANUP_LIMIT));
  const uploadRetentionDays = Math.max(
    1,
    Math.floor(input.uploadRetentionDays ?? DEFAULT_UPLOAD_RETENTION_DAYS)
  );
  const now = new Date();
  const nowIso = now.toISOString();
  const cutoffIso = new Date(
    now.getTime() - uploadRetentionDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const listOutputCandidates =
    dependencies.listOutputCandidates ?? defaultListOutputCandidates;
  const listUploadCandidates =
    dependencies.listUploadCandidates ?? defaultListUploadCandidates;
  const deleteStorageObject =
    dependencies.deleteStorageObject ?? defaultDeleteStorageObject;
  const deleteOutputRecord = dependencies.deleteOutputRecord ?? defaultDeleteOutputRecord;
  const deleteUploadRecord = dependencies.deleteUploadRecord ?? defaultDeleteUploadRecord;

  const outputs = await listOutputCandidates({
    limit: Math.max(1, Math.floor(limit / 2)),
    nowIso
  });
  const uploads = await listUploadCandidates({
    limit: Math.max(1, Math.ceil(limit / 2)),
    cutoffIso
  });

  let deletedOutputs = 0;
  let deletedUploads = 0;
  let failed = 0;
  const failureSamples: string[] = [];

  for (const output of outputs) {
    const storageResult = await deleteStorageObject(output.storagePath);
    if (!storageResult.ok) {
      failed += 1;
      captureFailure(
        failureSamples,
        `output:${output.id} storage delete failed (${storageResult.reason ?? "unknown"})`
      );
      continue;
    }

    try {
      await deleteOutputRecord(output.id, output.userId);
      deletedOutputs += 1;
    } catch (error) {
      failed += 1;
      captureFailure(
        failureSamples,
        `output:${output.id} row delete failed (${
          error instanceof Error ? error.message : String(error)
        })`
      );
    }
  }

  for (const upload of uploads) {
    const storageResult = await deleteStorageObject(upload.storagePath);
    if (!storageResult.ok) {
      failed += 1;
      captureFailure(
        failureSamples,
        `upload:${upload.id} storage delete failed (${storageResult.reason ?? "unknown"})`
      );
      continue;
    }

    try {
      await deleteUploadRecord(upload.id, upload.userId);
      deletedUploads += 1;
    } catch (error) {
      failed += 1;
      captureFailure(
        failureSamples,
        `upload:${upload.id} row delete failed (${
          error instanceof Error ? error.message : String(error)
        })`
      );
    }
  }

  return {
    skipped: false,
    scannedOutputs: outputs.length,
    scannedUploads: uploads.length,
    deletedOutputs,
    deletedUploads,
    failed,
    failureSamples
  };
}

async function defaultListOutputCandidates(input: {
  limit: number;
  nowIso: string;
}): Promise<OutputCandidate[]> {
  const client = createSupabaseAdminClient();
  const candidates = new Map<string, OutputCandidate>();

  const inactiveResult = await client
    .from("task_outputs")
    .select("id,user_id,storage_path")
    .eq("is_active", false)
    .order("created_at", { ascending: true })
    .limit(input.limit);

  if (inactiveResult.error) {
    throw new Error(`读取待清理交付文件失败：${inactiveResult.error.message}`);
  }

  for (const row of inactiveResult.data ?? []) {
    if (!row?.id || !row?.user_id || !row?.storage_path) {
      continue;
    }

    candidates.set(String(row.id), {
      id: String(row.id),
      userId: String(row.user_id),
      storagePath: String(row.storage_path)
    });
  }

  const expiredResult = await client
    .from("task_outputs")
    .select("id,user_id,storage_path")
    .lt("expires_at", input.nowIso)
    .order("expires_at", { ascending: true })
    .limit(input.limit);

  if (expiredResult.error) {
    throw new Error(`读取过期交付文件失败：${expiredResult.error.message}`);
  }

  for (const row of expiredResult.data ?? []) {
    if (!row?.id || !row?.user_id || !row?.storage_path) {
      continue;
    }

    if (candidates.size >= input.limit) {
      break;
    }

    candidates.set(String(row.id), {
      id: String(row.id),
      userId: String(row.user_id),
      storagePath: String(row.storage_path)
    });
  }

  return Array.from(candidates.values()).slice(0, input.limit);
}

async function defaultListUploadCandidates(input: {
  limit: number;
  cutoffIso: string;
}): Promise<UploadCandidate[]> {
  const client = createSupabaseAdminClient();
  const scanLimit = Math.max(200, input.limit * 5);
  const fileResult = await client
    .from("task_files")
    .select("id,user_id,task_id,storage_path,created_at")
    .lt("created_at", input.cutoffIso)
    .order("created_at", { ascending: true })
    .limit(scanLimit);

  if (fileResult.error) {
    throw new Error(`读取待清理上传文件失败：${fileResult.error.message}`);
  }

  const rawFiles = (fileResult.data ?? []).filter(
    (row) => row?.id && row?.user_id && row?.task_id && row?.storage_path
  );
  if (rawFiles.length === 0) {
    return [];
  }

  const taskIds = Array.from(new Set(rawFiles.map((row) => String(row.task_id))));
  const statusResult = await client
    .from("writing_tasks")
    .select("id,status")
    .in("id", taskIds);

  if (statusResult.error) {
    throw new Error(`读取任务状态失败：${statusResult.error.message}`);
  }

  const allowedTaskIds = new Set(
    (statusResult.data ?? [])
      .filter((row) =>
        TERMINAL_TASK_STATUSES.includes(row.status as (typeof TERMINAL_TASK_STATUSES)[number])
      )
      .map((row) => String(row.id))
  );

  return rawFiles
    .filter((row) => allowedTaskIds.has(String(row.task_id)))
    .slice(0, input.limit)
    .map((row) => ({
      id: String(row.id),
      userId: String(row.user_id),
      taskId: String(row.task_id),
      storagePath: String(row.storage_path)
    }));
}

async function defaultDeleteStorageObject(storagePath: string) {
  const client = createSupabaseAdminClient();
  const { error } = await client.storage
    .from(taskArtifactBucket)
    .remove([storagePath]);

  if (!error) {
    return {
      ok: true
    };
  }

  if (isStorageMissingError(error)) {
    return {
      ok: true
    };
  }

  return {
    ok: false,
    reason: error.message
  };
}

async function defaultDeleteOutputRecord(id: string, userId: string) {
  const client = createSupabaseAdminClient();
  const { error } = await client
    .from("task_outputs")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

async function defaultDeleteUploadRecord(id: string, userId: string) {
  const client = createSupabaseAdminClient();
  const { error } = await client
    .from("task_files")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

function captureFailure(samples: string[], detail: string) {
  if (samples.length < 20) {
    samples.push(detail);
  }
}

function isStorageMissingError(error: { message?: string; statusCode?: string | number }) {
  const message = String(error.message ?? "").toLowerCase();
  const statusCode = String(error.statusCode ?? "");
  return (
    message.includes("not found") ||
    message.includes("no such file") ||
    statusCode === "404"
  );
}

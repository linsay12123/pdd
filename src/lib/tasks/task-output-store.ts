import {
  requireFormalPersistence,
  shouldUseLocalTestPersistence,
  shouldUseSupabasePersistence
} from "@/src/lib/persistence/runtime-mode";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import {
  deleteTaskOutputRecord,
  findTaskOutputByStoragePath,
  getTaskOutput,
  getTaskOutputs,
  saveTaskOutputRecord
} from "@/src/lib/tasks/repository";
import {
  isTaskOutputExpired,
  resolveTaskOutputExpiresAt
} from "@/src/lib/tasks/task-output-expiry";
import type { TaskOutputKind, TaskOutputRecord } from "@/src/types/tasks";

type SaveTaskOutputInput = {
  taskId: string;
  userId: string;
  outputKind: TaskOutputKind;
  storagePath: string;
  isActive?: boolean;
  expiresAt?: string;
};

export async function saveTaskOutput(input: SaveTaskOutputInput) {
  if (shouldUseSupabasePersistence()) {
    return saveTaskOutputWithSupabase(input);
  }

  if (shouldUseLocalTestPersistence()) {
    return saveTaskOutputLocally(input);
  }

  requireFormalPersistence();
}

export async function getOwnedTaskOutput(input: {
  taskId: string;
  outputId: string;
  userId: string;
}) {
  if (shouldUseSupabasePersistence()) {
    return getOwnedTaskOutputWithSupabase(input);
  }

  if (shouldUseLocalTestPersistence()) {
    return getOwnedTaskOutputLocally(input);
  }

  requireFormalPersistence();
}

export async function listOwnedTaskOutputs(input: { taskId: string; userId: string }) {
  if (shouldUseSupabasePersistence()) {
    return listOwnedTaskOutputsWithSupabase(input);
  }

  if (shouldUseLocalTestPersistence()) {
    return listOwnedTaskOutputsLocally(input);
  }

  requireFormalPersistence();
}

export async function findOwnedTaskOutputByStoragePath(input: {
  storagePath: string;
  userId: string;
}) {
  if (shouldUseSupabasePersistence()) {
    return findOwnedTaskOutputByStoragePathWithSupabase(input);
  }

  if (shouldUseLocalTestPersistence()) {
    return findOwnedTaskOutputByStoragePathLocally(input);
  }

  requireFormalPersistence();
}

export async function deleteOwnedTaskOutput(input: {
  taskId: string;
  outputId: string;
  userId: string;
}) {
  if (shouldUseSupabasePersistence()) {
    return deleteOwnedTaskOutputWithSupabase(input);
  }

  if (shouldUseLocalTestPersistence()) {
    return deleteOwnedTaskOutputLocally(input);
  }

  requireFormalPersistence();
}

function saveTaskOutputLocally(input: SaveTaskOutputInput) {
  return saveTaskOutputRecord({
    taskId: input.taskId,
    userId: input.userId,
    outputKind: input.outputKind,
    storagePath: input.storagePath,
    isActive: input.isActive ?? true,
    expiresAt: input.expiresAt
  });
}

async function saveTaskOutputWithSupabase(input: SaveTaskOutputInput) {
  const client = createSupabaseAdminClient();
  const createdAt = new Date().toISOString();
  const expiresAt = resolveTaskOutputExpiresAt({
    createdAt,
    expiresAt: input.expiresAt ?? null
  });

  if (input.isActive ?? true) {
    const { error: deactivateError } = await client
      .from("task_outputs")
      .update({
        is_active: false
      })
      .eq("task_id", input.taskId)
      .eq("user_id", input.userId)
      .eq("output_kind", input.outputKind)
      .eq("is_active", true);

    if (deactivateError) {
      throw new Error(`停用旧交付物失败：${deactivateError.message}`);
    }
  }

  const { data, error } = await client
    .from("task_outputs")
    .insert({
      task_id: input.taskId,
      user_id: input.userId,
      output_kind: input.outputKind,
      storage_path: input.storagePath,
      is_active: input.isActive ?? true,
      created_at: createdAt,
      expires_at: expiresAt
    })
    .select("id,task_id,user_id,output_kind,storage_path,is_active,expires_at,created_at")
    .single();

  if (error || !data) {
    throw new Error(`保存交付文件失败：${error?.message ?? "数据库没有返回交付文件"}`);
  }

  return mapTaskOutputRow(data);
}

function getOwnedTaskOutputLocally({
  taskId,
  outputId,
  userId
}: {
  taskId: string;
  outputId: string;
  userId: string;
}) {
  const output = getTaskOutput(taskId, outputId);
  return output && output.userId === userId ? output : null;
}

async function getOwnedTaskOutputWithSupabase({
  taskId,
  outputId,
  userId
}: {
  taskId: string;
  outputId: string;
  userId: string;
}) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("task_outputs")
    .select("id,task_id,user_id,output_kind,storage_path,is_active,expires_at,created_at")
    .eq("id", outputId)
    .eq("task_id", taskId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`读取交付文件失败：${error.message}`);
  }

  return data ? mapTaskOutputRow(data) : null;
}

function listOwnedTaskOutputsLocally({ taskId, userId }: { taskId: string; userId: string }) {
  return getTaskOutputs(taskId).filter((output) => output.userId === userId);
}

async function listOwnedTaskOutputsWithSupabase({
  taskId,
  userId
}: {
  taskId: string;
  userId: string;
}) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("task_outputs")
    .select("id,task_id,user_id,output_kind,storage_path,is_active,expires_at,created_at")
    .eq("task_id", taskId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`读取交付文件列表失败：${error.message}`);
  }

  return (data ?? []).map(mapTaskOutputRow);
}

function findOwnedTaskOutputByStoragePathLocally({
  storagePath,
  userId
}: {
  storagePath: string;
  userId: string;
}) {
  const output = findTaskOutputByStoragePath(storagePath);
  return output && output.userId === userId ? output : null;
}

function deleteOwnedTaskOutputLocally({
  taskId,
  outputId,
  userId
}: {
  taskId: string;
  outputId: string;
  userId: string;
}) {
  deleteTaskOutputRecord(taskId, outputId, userId);
}

async function findOwnedTaskOutputByStoragePathWithSupabase({
  storagePath,
  userId
}: {
  storagePath: string;
  userId: string;
}) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("task_outputs")
    .select("id,task_id,user_id,output_kind,storage_path,is_active,expires_at,created_at")
    .eq("storage_path", storagePath)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(`读取交付文件失败：${error.message}`);
  }

  return data ? mapTaskOutputRow(data) : null;
}

async function deleteOwnedTaskOutputWithSupabase({
  taskId,
  outputId,
  userId
}: {
  taskId: string;
  outputId: string;
  userId: string;
}) {
  const client = createSupabaseAdminClient();
  const { error } = await client
    .from("task_outputs")
    .delete()
    .eq("id", outputId)
    .eq("task_id", taskId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`删除交付文件记录失败：${error.message}`);
  }
}

function mapTaskOutputRow(row: {
  id: string;
  task_id: string;
  user_id: string;
  output_kind: TaskOutputKind;
  storage_path: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}) {
  const expiresAt = resolveTaskOutputExpiresAt({
    createdAt: row.created_at,
    expiresAt: row.expires_at
  });

  return {
    id: String(row.id),
    taskId: String(row.task_id),
    userId: String(row.user_id),
    outputKind: row.output_kind,
    storagePath: String(row.storage_path),
    isActive: Boolean(row.is_active),
    createdAt: String(row.created_at),
    expiresAt,
    expired: isTaskOutputExpired({
      expiresAt,
      now: new Date().toISOString()
    })
  } satisfies TaskOutputRecord;
}

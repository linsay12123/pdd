import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import {
  findTaskOutputByStoragePath,
  getTaskOutput,
  getTaskOutputs,
  saveTaskOutputRecord
} from "@/src/lib/tasks/repository";
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
  return shouldUseSupabasePersistence()
    ? saveTaskOutputWithSupabase(input)
    : saveTaskOutputLocally(input);
}

export async function getOwnedTaskOutput(input: {
  taskId: string;
  outputId: string;
  userId: string;
}) {
  return shouldUseSupabasePersistence()
    ? getOwnedTaskOutputWithSupabase(input)
    : getOwnedTaskOutputLocally(input);
}

export async function listOwnedTaskOutputs(input: { taskId: string; userId: string }) {
  return shouldUseSupabasePersistence()
    ? listOwnedTaskOutputsWithSupabase(input)
    : listOwnedTaskOutputsLocally(input);
}

export async function findOwnedTaskOutputByStoragePath(input: {
  storagePath: string;
  userId: string;
}) {
  return shouldUseSupabasePersistence()
    ? findOwnedTaskOutputByStoragePathWithSupabase(input)
    : findOwnedTaskOutputByStoragePathLocally(input);
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
      expires_at: input.expiresAt ?? undefined
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
  const expiresAt =
    row.expires_at ??
    new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

  return {
    id: String(row.id),
    taskId: String(row.task_id),
    userId: String(row.user_id),
    outputKind: row.output_kind,
    storagePath: String(row.storage_path),
    isActive: Boolean(row.is_active),
    createdAt: String(row.created_at),
    expiresAt,
    expired: expiresAt <= new Date().toISOString()
  } satisfies TaskOutputRecord;
}

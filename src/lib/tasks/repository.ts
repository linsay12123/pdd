import { incrementMetric } from "@/src/lib/observability/metrics";
import { logTaskTransition } from "@/src/lib/observability/logger";
import type {
  TaskFileRecord,
  TaskFileRecordInput,
  TaskOutlineVersion,
  TaskOutlineVersionInput,
  TaskOutputRecord,
  TaskOutputRecordInput,
  TaskStatus,
  TaskSummary
} from "@/src/types/tasks";

const taskStore = new Map<string, TaskSummary>();
const taskFileStore = new Map<string, TaskFileRecord[]>();
const taskOutlineStore = new Map<string, TaskOutlineVersion[]>();
const taskOutputStore = new Map<string, TaskOutputRecord[]>();

export function saveTaskSummary(task: TaskSummary) {
  taskStore.set(task.id, task);
  return task;
}

export function resetTaskStore() {
  taskStore.clear();
}

export function getTaskSummary(taskId: string) {
  return taskStore.get(taskId) ?? null;
}

export function patchTaskSummary(taskId: string, patch: Partial<TaskSummary>) {
  const existing = taskStore.get(taskId);

  if (!existing) {
    return null;
  }

  const nextTask = {
    ...existing,
    ...patch
  };

  taskStore.set(taskId, nextTask);
  return nextTask;
}

export function updateTaskStatus(taskId: string, status: TaskStatus) {
  const existing = taskStore.get(taskId);

  if (!existing) {
    return null;
  }

  const nextTask = {
    ...existing,
    status
  };

  taskStore.set(taskId, nextTask);
  logTaskTransition({
    taskId,
    userId: existing.userId ?? "unknown",
    oldStatus: existing.status,
    newStatus: status
  });
  incrementMetric("task_status_transition");
  return nextTask;
}

export function saveTaskFileRecord(record: TaskFileRecordInput) {
  const existing = taskFileStore.get(record.taskId) ?? [];
  const normalizedRecord: TaskFileRecord = {
    id: record.id || `file_${record.taskId}_${existing.length + 1}`,
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: record.updatedAt || new Date().toISOString(),
    ...record
  };
  const nextFiles = [...existing, normalizedRecord];

  taskFileStore.set(record.taskId, nextFiles);
  return normalizedRecord;
}

export function saveTaskFileRecords(records: TaskFileRecordInput[]) {
  return records.map((record) => saveTaskFileRecord(record));
}

export function listTaskFiles(taskId: string) {
  return taskFileStore.get(taskId) ?? [];
}

export function getTaskFile(taskId: string, fileId: string) {
  return listTaskFiles(taskId).find((file) => file.id === fileId) ?? null;
}

export function replaceTaskFiles(taskId: string, files: TaskFileRecord[]) {
  taskFileStore.set(taskId, files);
  return files;
}

export function resetTaskFileStore() {
  taskFileStore.clear();
}

export function saveTaskOutlineVersion(record: TaskOutlineVersionInput) {
  const existing = taskOutlineStore.get(record.taskId) ?? [];
  const normalizedRecord: TaskOutlineVersion = {
    id: record.id || `outline_${record.taskId}_${existing.length + 1}`,
    createdAt: record.createdAt || new Date().toISOString(),
    ...record
  };
  const nextVersions = [...existing, normalizedRecord];

  taskOutlineStore.set(record.taskId, nextVersions);
  return normalizedRecord;
}

export function listTaskOutlineVersions(taskId: string) {
  return taskOutlineStore.get(taskId) ?? [];
}

export function getTaskOutlineVersion(taskId: string, outlineVersionId: string) {
  return listTaskOutlineVersions(taskId).find((item) => item.id === outlineVersionId) ?? null;
}

export function replaceTaskOutlineVersions(taskId: string, versions: TaskOutlineVersion[]) {
  taskOutlineStore.set(taskId, versions);
  return versions;
}

export function resetTaskOutlineStore() {
  taskOutlineStore.clear();
}

export function saveTaskOutputRecord(record: TaskOutputRecordInput) {
  const existing = taskOutputStore.get(record.taskId) ?? [];
  const normalizedRecord: TaskOutputRecord = {
    id: record.id || `out_${record.taskId}_${existing.length + 1}`,
    createdAt: record.createdAt || new Date().toISOString(),
    expiresAt:
      record.expiresAt ||
      new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    expired: record.expired ?? false,
    ...record
  };
  const nextOutputs = [...existing, normalizedRecord];

  taskOutputStore.set(record.taskId, nextOutputs);
  return normalizedRecord;
}

export function getTaskOutputs(taskId: string) {
  return taskOutputStore.get(taskId) ?? [];
}

export function getTaskOutput(taskId: string, outputId: string) {
  return getTaskOutputs(taskId).find((output) => output.id === outputId) ?? null;
}

export function expireTaskOutputs({
  asOf = new Date().toISOString()
}: {
  asOf?: string;
}) {
  const expiredOutputIds: string[] = [];

  for (const [taskId, outputs] of taskOutputStore.entries()) {
    const nextOutputs = outputs.map((output) => {
      if (output.expired) {
        return output;
      }

      if (output.expiresAt > asOf) {
        return output;
      }

      expiredOutputIds.push(output.id);
      return {
        ...output,
        expired: true
      };
    });

    taskOutputStore.set(taskId, nextOutputs);
  }

  return {
    expiredOutputIds,
    taskHistoryStillVisible: true
  };
}

export function resetTaskOutputStore() {
  taskOutputStore.clear();
}

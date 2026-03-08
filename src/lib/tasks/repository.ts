import { incrementMetric } from "@/src/lib/observability/metrics";
import { logTaskTransition } from "@/src/lib/observability/logger";
import { resolveTaskOutputExpiresAt } from "@/src/lib/tasks/task-output-expiry";
import { assertStatusTransition } from "@/src/lib/tasks/status-machine";
import type {
  TaskDraftVersion,
  TaskDraftVersionInput,
  TaskFileRecord,
  TaskFileRecordInput,
  TaskOutlineVersion,
  TaskOutlineVersionInput,
  TaskOutputRecord,
  TaskOutputRecordInput,
  TaskReferenceCheck,
  TaskReferenceCheckInput,
  TaskStatus,
  TaskSummary
} from "@/src/types/tasks";

const taskStore = new Map<string, TaskSummary>();
const taskFileStore = new Map<string, TaskFileRecord[]>();
const taskOutlineStore = new Map<string, TaskOutlineVersion[]>();
const taskDraftStore = new Map<string, TaskDraftVersion[]>();
const taskReferenceCheckStore = new Map<string, TaskReferenceCheck[]>();
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

  if (patch.status) {
    assertStatusTransition(existing.status, patch.status);
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

  assertStatusTransition(existing.status, status);

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
    ...record,
    id: record.id || `file_${record.taskId}_${existing.length + 1}`,
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: record.updatedAt || new Date().toISOString()
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
    ...record,
    id: record.id || `outline_${record.taskId}_${existing.length + 1}`,
    createdAt: record.createdAt || new Date().toISOString()
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

export function saveTaskDraftVersion(record: TaskDraftVersionInput) {
  const existing = taskDraftStore.get(record.taskId) ?? [];
  const normalizedRecord: TaskDraftVersion = {
    ...record,
    id: record.id || `draft_${record.taskId}_${existing.length + 1}`,
    createdAt: record.createdAt || new Date().toISOString()
  };
  const nextVersions = [...existing, normalizedRecord];

  taskDraftStore.set(record.taskId, nextVersions);
  return normalizedRecord;
}

export function listTaskDraftVersions(taskId: string) {
  return taskDraftStore.get(taskId) ?? [];
}

export function getTaskDraftVersion(taskId: string, draftVersionId: string) {
  return listTaskDraftVersions(taskId).find((item) => item.id === draftVersionId) ?? null;
}

export function replaceTaskDraftVersions(taskId: string, versions: TaskDraftVersion[]) {
  taskDraftStore.set(taskId, versions);
  return versions;
}

export function resetTaskDraftStore() {
  taskDraftStore.clear();
}

export function saveTaskReferenceCheck(record: TaskReferenceCheckInput) {
  const existing = taskReferenceCheckStore.get(record.taskId) ?? [];
  const normalizedRecord: TaskReferenceCheck = {
    ...record,
    id: record.id || `ref_${record.taskId}_${existing.length + 1}`,
    createdAt: record.createdAt || new Date().toISOString()
  };
  const nextChecks = [...existing, normalizedRecord];

  taskReferenceCheckStore.set(record.taskId, nextChecks);
  return normalizedRecord;
}

export function saveTaskReferenceChecks(records: TaskReferenceCheckInput[]) {
  return records.map((record) => saveTaskReferenceCheck(record));
}

export function listTaskReferenceChecks(taskId: string) {
  return taskReferenceCheckStore.get(taskId) ?? [];
}

export function resetTaskReferenceCheckStore() {
  taskReferenceCheckStore.clear();
}

export function saveTaskOutputRecord(record: TaskOutputRecordInput) {
  const existing = taskOutputStore.get(record.taskId) ?? [];
  const createdAt = record.createdAt || new Date().toISOString();
  const expiresAt = resolveTaskOutputExpiresAt({
    createdAt,
    expiresAt: record.expiresAt ?? null
  });
  const normalizedRecord: TaskOutputRecord = {
    ...record,
    id: record.id || `out_${record.taskId}_${existing.length + 1}`,
    createdAt,
    isActive: record.isActive ?? true,
    expiresAt,
    expired: record.expired ?? expiresAt <= new Date().toISOString()
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

export function findTaskOutputByStoragePath(storagePath: string) {
  for (const outputs of taskOutputStore.values()) {
    const match = outputs.find((output) => output.storagePath === storagePath);

    if (match) {
      return match;
    }
  }

  return null;
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

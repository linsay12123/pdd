import type { TaskOutputRecord, TaskStatus, TaskSummary } from "@/src/types/tasks";

const taskStore = new Map<string, TaskSummary>();
const taskOutputStore = new Map<string, TaskOutputRecord[]>();

export function saveTaskSummary(task: TaskSummary) {
  taskStore.set(task.id, task);
  return task;
}

export function getTaskSummary(taskId: string) {
  return taskStore.get(taskId) ?? null;
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
  return nextTask;
}

export function saveTaskOutputRecord(record: TaskOutputRecord) {
  const existing = taskOutputStore.get(record.taskId) ?? [];
  const nextOutputs = [...existing, record];

  taskOutputStore.set(record.taskId, nextOutputs);
  return record;
}

export function getTaskOutputs(taskId: string) {
  return taskOutputStore.get(taskId) ?? [];
}

export function resetTaskOutputStore() {
  taskOutputStore.clear();
}

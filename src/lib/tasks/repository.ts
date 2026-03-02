import type { TaskStatus, TaskSummary } from "@/src/types/tasks";

const taskStore = new Map<string, TaskSummary>();

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

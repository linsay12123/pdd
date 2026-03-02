import type { TaskStatus } from "@/src/types/tasks";

export type TaskEvent = {
  taskId: string;
  fromStatus: TaskStatus;
  toStatus: TaskStatus;
  createdAt: string;
};

const taskEvents: TaskEvent[] = [];

export function recordTaskEvent(taskId: string, fromStatus: TaskStatus, toStatus: TaskStatus) {
  const event: TaskEvent = {
    taskId,
    fromStatus,
    toStatus,
    createdAt: new Date().toISOString()
  };

  taskEvents.push(event);
  return event;
}

export function listTaskEvents(taskId: string) {
  return taskEvents.filter((event) => event.taskId === taskId);
}

import path from "node:path";

export function createTaskOutputStoragePath(
  userId: string,
  taskId: string,
  filename: string
) {
  const safeName = filename.replaceAll(/\s+/g, "-").toLowerCase();
  return `users/${userId}/tasks/${taskId}/outputs/${safeName}`;
}

export function resolveStoredFileDiskPath(storagePath: string) {
  return path.join(process.cwd(), "storage", storagePath);
}

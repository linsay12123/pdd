export type StoredUpload = {
  originalFilename: string;
  storagePath: string;
};

export function createTaskStoragePath(userId: string, taskId: string, filename: string) {
  const safeName = filename.replaceAll(/\s+/g, "-").toLowerCase();
  return `users/${userId}/tasks/${taskId}/uploads/${safeName}`;
}

export async function saveUploadPlaceholder(
  userId: string,
  taskId: string,
  filename: string
): Promise<StoredUpload> {
  return {
    originalFilename: filename,
    storagePath: createTaskStoragePath(userId, taskId, filename)
  };
}

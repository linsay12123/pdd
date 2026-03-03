type RequestTaskDownloadInput = {
  taskId: string;
  outputId: string;
  fetchImpl?: typeof fetch;
};

export async function requestTaskDownload({
  taskId,
  outputId,
  fetchImpl = fetch
}: RequestTaskDownloadInput) {
  const response = await fetchImpl(`/api/tasks/${taskId}/downloads/${outputId}`);
  const payload = (await response.json().catch(() => null)) as
    | {
        signedUrl?: string;
        message?: string;
      }
    | null;

  if (!response.ok || !payload?.signedUrl) {
    throw new Error(payload?.message ?? "下载链接生成失败，请稍后再试");
  }

  return {
    signedUrl: payload.signedUrl
  };
}

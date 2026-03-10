export const WORKFLOW_STARTUP_PENDING_VERSION_MESSAGE =
  "后台正文任务版本还没准备好，请稍后重新确认大纲。";

export const WORKFLOW_STARTUP_STALLED_MESSAGE =
  "后台正文任务没有真正启动成功，请重新确认大纲后再试。";

export const WORKFLOW_STREAM_RECONNECTING_MESSAGE =
  "进度连接短暂中断，系统正在自动重连。";

export const WORKFLOW_PROGRESS_RETRYING_MESSAGE =
  "读取正文进度暂时失败，系统继续重试。";

export function isWorkflowStartupFailureMessage(message: string | null | undefined) {
  if (typeof message !== "string" || !message.trim()) {
    return false;
  }

  return (
    message.includes(WORKFLOW_STARTUP_PENDING_VERSION_MESSAGE) ||
    message.includes(WORKFLOW_STARTUP_STALLED_MESSAGE)
  );
}

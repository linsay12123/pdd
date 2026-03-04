export type MetricName =
  | "task_status_transition"
  | "task_manual_retry";

const metricStore = new Map<MetricName, number>();
const retryAttemptStore = new Map<string, number>();

export function incrementMetric(name: MetricName, amount = 1) {
  const nextCount = (metricStore.get(name) ?? 0) + amount;

  metricStore.set(name, nextCount);
  return nextCount;
}

export function getMetricCount(name: MetricName) {
  return metricStore.get(name) ?? 0;
}

export function recordRetryAttempt(taskId: string) {
  const nextAttempt = (retryAttemptStore.get(taskId) ?? 0) + 1;

  retryAttemptStore.set(taskId, nextAttempt);
  incrementMetric("task_manual_retry");

  return nextAttempt;
}

export function getRetryAttemptCount(taskId: string) {
  return retryAttemptStore.get(taskId) ?? 0;
}

export function resetMetrics() {
  metricStore.clear();
  retryAttemptStore.clear();
}

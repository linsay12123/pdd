export type TriggerCliCredentials = {
  accessToken: string;
  apiUrl: string;
};

export type TriggerRuntimeSnapshot = {
  state: "active" | "pending_version" | "terminal" | "missing" | "unknown";
  status: string | null;
};

export function loadTriggerCliCredentials(input?: {
  configPath?: string;
}): Promise<TriggerCliCredentials>;

export function getTriggerProductionEnvironment(input: {
  projectRef?: string;
  accessToken: string;
  apiUrl?: string;
  fetchImpl?: typeof fetch;
}): Promise<any>;

export function getTriggerCurrentWorker(input: {
  projectRef?: string;
  accessToken: string;
  apiUrl?: string;
  fetchImpl?: typeof fetch;
}): Promise<any>;

export function extractWorkerTaskSlugs(payload: any): string[];

export function assertRequiredTriggerTasks(payload: any): string[];

export function resolveTriggerRuntimeState(status: string | null | undefined): TriggerRuntimeSnapshot;

export function triggerMinimalApprovedTaskRun(input: {
  envApiKey: string;
  triggerTask?: (envApiKey: string) => Promise<string | null>;
}): Promise<string>;

export function pollTriggerRunStartup(input: {
  runId: string;
  envApiKey: string;
  retrieveRunState?: (runId: string, envApiKey: string) => Promise<TriggerRuntimeSnapshot>;
  sleep?: (ms: number) => Promise<void>;
  intervalMs?: number;
  timeoutMs?: number;
}): Promise<{
  ok: boolean;
  runtime: TriggerRuntimeSnapshot;
}>;

export function checkTriggerProdStartup(input?: {
  projectRef?: string;
  credentials?: TriggerCliCredentials;
  loadCredentials?: () => Promise<TriggerCliCredentials>;
  fetchImpl?: typeof fetch;
  triggerTask?: (envApiKey: string) => Promise<string | null>;
  retrieveRunState?: (runId: string, envApiKey: string) => Promise<TriggerRuntimeSnapshot>;
  sleep?: (ms: number) => Promise<void>;
}): Promise<{
  projectRef: string;
  workerVersion: string | null;
  taskSlugs: string[];
  runId: string;
  runtime: TriggerRuntimeSnapshot;
}>;

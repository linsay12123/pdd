#!/usr/bin/env node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const DEFAULT_TRIGGER_API_URL = "https://api.trigger.dev";
const DEFAULT_TRIGGER_PROJECT_REF =
  process.env.TRIGGER_PROJECT_REF?.trim() || "proj_gqnvgaxgopascpyorxem";
const REQUIRED_TASK_SLUGS = [
  "process-approved-task",
  "verify-approved-task-startup"
];
const POLL_INTERVAL_MS = 2_000;
const MAX_WAIT_MS = 30_000;

export async function loadTriggerCliCredentials({
  configPath = path.join(
    os.homedir(),
    "Library",
    "Preferences",
    "trigger",
    "config.json"
  )
} = {}) {
  const raw = await fs.readFile(configPath, "utf8");
  const parsed = JSON.parse(raw);
  const currentProfileName =
    typeof parsed?.currentProfile === "string" && parsed.currentProfile.trim()
      ? parsed.currentProfile.trim()
      : "default";
  const profile = parsed?.profiles?.[currentProfileName];

  const accessToken =
    typeof profile?.accessToken === "string" ? profile.accessToken.trim() : "";
  const apiUrl =
    typeof profile?.apiUrl === "string" && profile.apiUrl.trim()
      ? profile.apiUrl.trim()
      : DEFAULT_TRIGGER_API_URL;

  if (!accessToken) {
    throw new Error("TRIGGER_CLI_ACCESS_TOKEN_MISSING");
  }

  return {
    accessToken,
    apiUrl
  };
}

async function requestTriggerJson(url, accessToken, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`TRIGGER_API_REQUEST_FAILED:${response.status}`);
  }

  return response.json();
}

export async function getTriggerProductionEnvironment({
  projectRef = DEFAULT_TRIGGER_PROJECT_REF,
  accessToken,
  apiUrl = DEFAULT_TRIGGER_API_URL,
  fetchImpl = fetch
}) {
  return requestTriggerJson(
    `${apiUrl.replace(/\/$/, "")}/api/v1/projects/${projectRef}/prod`,
    accessToken,
    fetchImpl
  );
}

export async function getTriggerCurrentWorker({
  projectRef = DEFAULT_TRIGGER_PROJECT_REF,
  accessToken,
  apiUrl = DEFAULT_TRIGGER_API_URL,
  fetchImpl = fetch
}) {
  return requestTriggerJson(
    `${apiUrl.replace(/\/$/, "")}/api/v1/projects/${projectRef}/prod/workers/current`,
    accessToken,
    fetchImpl
  );
}

export function extractWorkerTaskSlugs(payload) {
  const tasks = Array.isArray(payload?.worker?.tasks) ? payload.worker.tasks : [];
  return tasks
    .map((task) => (typeof task?.slug === "string" ? task.slug : null))
    .filter((slug) => Boolean(slug));
}

export function assertRequiredTriggerTasks(payload) {
  const taskSlugs = extractWorkerTaskSlugs(payload);
  const missingTaskSlugs = REQUIRED_TASK_SLUGS.filter((slug) => !taskSlugs.includes(slug));

  if (missingTaskSlugs.length > 0) {
    throw new Error(`TRIGGER_REQUIRED_TASKS_MISSING:${missingTaskSlugs.join(",")}`);
  }

  return taskSlugs;
}

export function resolveTriggerRuntimeState(status) {
  if (typeof status !== "string" || !status.trim()) {
    return {
      state: "unknown",
      status: null
    };
  }

  if (status === "PENDING_VERSION") {
    return {
      state: "pending_version",
      status
    };
  }

  if (
    ["QUEUED", "DEQUEUED", "EXECUTING", "WAITING", "DELAYED"].includes(status)
  ) {
    return {
      state: "active",
      status
    };
  }

  return {
    state: "terminal",
    status
  };
}

export async function triggerMinimalApprovedTaskRun({
  envApiKey,
  triggerTask = defaultTriggerTask
}) {
  const runId = await triggerTask(envApiKey);

  if (typeof runId !== "string" || !runId.trim()) {
    throw new Error("TRIGGER_SELF_CHECK_RUN_ID_MISSING");
  }

  return runId;
}

export async function pollTriggerRunStartup({
  runId,
  envApiKey,
  retrieveRunState = defaultRetrieveRunState,
  sleep = defaultSleep,
  intervalMs = POLL_INTERVAL_MS,
  timeoutMs = MAX_WAIT_MS
}) {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    const runtime = await retrieveRunState(runId, envApiKey);

    if (runtime.state === "pending_version") {
      return {
        ok: false,
        runtime
      };
    }

    if (runtime.state === "active" || runtime.state === "terminal") {
      return {
        ok: true,
        runtime
      };
    }

    await sleep(intervalMs);
  }

  return {
    ok: false,
    runtime: {
      state: "unknown",
      status: null
    }
  };
}

export async function checkTriggerProdStartup({
  projectRef = DEFAULT_TRIGGER_PROJECT_REF,
  credentials,
  loadCredentials = loadTriggerCliCredentials,
  fetchImpl = fetch,
  triggerTask = defaultTriggerTask,
  retrieveRunState = defaultRetrieveRunState,
  sleep = defaultSleep
} = {}) {
  const resolvedCredentials = credentials ?? (await loadCredentials());
  const productionEnvironment = await getTriggerProductionEnvironment({
    projectRef,
    accessToken: resolvedCredentials.accessToken,
    apiUrl: resolvedCredentials.apiUrl,
    fetchImpl
  });
  const currentWorker = await getTriggerCurrentWorker({
    projectRef,
    accessToken: resolvedCredentials.accessToken,
    apiUrl: resolvedCredentials.apiUrl,
    fetchImpl
  });

  const taskSlugs = assertRequiredTriggerTasks(currentWorker);
  const runId = await triggerMinimalApprovedTaskRun({
    envApiKey: productionEnvironment.apiKey,
    triggerTask
  });
  const startup = await pollTriggerRunStartup({
    runId,
    envApiKey: productionEnvironment.apiKey,
    retrieveRunState,
    sleep
  });

  if (!startup.ok) {
    throw new Error(
      startup.runtime.state === "pending_version"
        ? "TRIGGER_SELF_CHECK_PENDING_VERSION"
        : "TRIGGER_SELF_CHECK_STARTUP_STALLED"
    );
  }

  return {
    projectRef,
    workerVersion:
      typeof currentWorker?.worker?.version === "string"
        ? currentWorker.worker.version
        : null,
    taskSlugs,
    runId,
    runtime: startup.runtime
  };
}

async function defaultTriggerTask(envApiKey) {
  const previousSecretKey = process.env.TRIGGER_SECRET_KEY;
  process.env.TRIGGER_SECRET_KEY = envApiKey;

  try {
    const { tasks } = await import("@trigger.dev/sdk/v3");
    const handle = await tasks.trigger(
      "process-approved-task",
      {
        taskId: "__trigger_prod_self_check__",
        userId: "__trigger_prod_self_check__",
        approvalAttemptCount: 0,
        safetyIdentifier: "trigger-prod-self-check"
      },
      {
        queue: "process-approved-task-self-check",
        idempotencyKey: `trigger-prod-self-check-${Date.now()}`
      }
    );

    return typeof handle?.id === "string" ? handle.id : null;
  } finally {
    if (typeof previousSecretKey === "string") {
      process.env.TRIGGER_SECRET_KEY = previousSecretKey;
    } else {
      delete process.env.TRIGGER_SECRET_KEY;
    }
  }
}

async function defaultRetrieveRunState(runId, envApiKey) {
  const previousSecretKey = process.env.TRIGGER_SECRET_KEY;
  process.env.TRIGGER_SECRET_KEY = envApiKey;

  try {
    const { runs } = await import("@trigger.dev/sdk/v3");
    const run = await runs.retrieve(runId);
    return resolveTriggerRuntimeState(run?.status);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("not found")) {
      return {
        state: "missing",
        status: null
      };
    }

    return {
      state: "unknown",
      status: null
    };
  } finally {
    if (typeof previousSecretKey === "string") {
      process.env.TRIGGER_SECRET_KEY = previousSecretKey;
    } else {
      delete process.env.TRIGGER_SECRET_KEY;
    }
  }
}

function defaultSleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function main() {
  try {
    const summary = await checkTriggerProdStartup();
    console.log(
      JSON.stringify(
        {
          ok: true,
          ...summary
        },
        null,
        2
      )
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      JSON.stringify(
        {
          ok: false,
          message
        },
        null,
        2
      )
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}

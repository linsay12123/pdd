import { runs } from "@trigger.dev/sdk/v3";

export type TriggerRunRuntimeState =
  | "active"
  | "pending_version"
  | "terminal"
  | "missing"
  | "unknown";

const ACTIVE_STATUSES = new Set([
  "QUEUED",
  "DEQUEUED",
  "EXECUTING",
  "WAITING",
  "DELAYED"
]);

type ResolveTriggerRunStateOptions = {
  retrieveRun?: (runId: string) => Promise<{ status?: string } | null | undefined>;
};

export async function resolveTriggerRunState(
  runId: string,
  options: ResolveTriggerRunStateOptions = {}
): Promise<{
  state: TriggerRunRuntimeState;
  status: string | null;
}> {
  const retrieveRun = options.retrieveRun ?? defaultRetrieveRun;

  try {
    const run = await retrieveRun(runId);
    const status = typeof run?.status === "string" ? run.status : null;

    if (!status) {
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

    if (ACTIVE_STATUSES.has(status)) {
      return {
        state: "active",
        status
      };
    }

    return {
      state: "terminal",
      status
    };
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
  }
}

async function defaultRetrieveRun(runId: string) {
  return runs.retrieve(runId);
}

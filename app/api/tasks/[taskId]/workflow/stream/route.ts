import { requireCurrentSessionUser } from "@/src/lib/auth/current-user";
import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import { buildTaskWorkflowSnapshot } from "@/src/lib/tasks/workflow-snapshot";
import type { SessionUser } from "@/src/types/auth";

type RouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

type WorkflowStreamDependencies = {
  requireUser?: () => Promise<SessionUser>;
  isPersistenceReady?: () => boolean;
  getWorkflowSnapshot?: (input: {
    taskId: string;
    userId: string;
  }) => Promise<{
    ok: true;
    task: {
      id: string;
      status: string;
      targetWordCount: number | null;
      citationStyle: string | null;
      specialRequirements: string;
      lastWorkflowStage?: string | null;
      workflowStageTimestamps?: Record<string, string>;
    };
    downloads: {
      finalDocxOutputId: string | null;
      referenceReportOutputId: string | null;
      humanizedDocxOutputId: string | null;
    };
    finalWordCount: number | null;
    message: string;
  }>;
};

const WORKFLOW_STREAM_INTERVAL_MS = 500;

export async function handleTaskWorkflowStreamRequest(
  request: Request,
  params: {
    taskId: string;
  },
  dependencies: WorkflowStreamDependencies = {}
) {
  try {
    if (!(dependencies.isPersistenceReady ?? shouldUseSupabasePersistence)()) {
      return new Response("event: error\ndata: {\"message\":\"系统当前还没连上正式数据库。\"}\n\n", {
        status: 503,
        headers: {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache, no-transform",
          connection: "keep-alive"
        }
      });
    }

    const user = await (dependencies.requireUser ?? requireCurrentSessionUser)();
    const getWorkflowSnapshot =
      dependencies.getWorkflowSnapshot ??
      ((input: { taskId: string; userId: string }) => buildTaskWorkflowSnapshot(input));
    const encoder = new TextEncoder();

    let intervalId: ReturnType<typeof setInterval> | null = null;
    let closed = false;
    let previousPayload = "";

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const closeStream = () => {
          if (closed) {
            return;
          }
          closed = true;
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
          controller.close();
        };

        const pushSnapshot = async () => {
          if (closed) {
            return;
          }

          try {
            const snapshot = await getWorkflowSnapshot({
              taskId: params.taskId,
              userId: user.id
            });
            const payload = JSON.stringify(snapshot);

            if (payload !== previousPayload) {
              previousPayload = payload;
              controller.enqueue(
                encoder.encode(`event: workflow\ndata: ${payload}\n\n`)
              );
              return;
            }

            controller.enqueue(encoder.encode(": keep-alive\n\n"));
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "读取正文流程进度失败";
            controller.enqueue(
              encoder.encode(
                `event: error\ndata: ${JSON.stringify({ message })}\n\n`
              )
            );
          }
        };

        request.signal.addEventListener("abort", closeStream, { once: true });

        await pushSnapshot();
        intervalId = setInterval(() => {
          void pushSnapshot();
        }, WORKFLOW_STREAM_INTERVAL_MS);
      },
      cancel() {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      }
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive"
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return new Response(
        "event: error\ndata: {\"message\":\"请先登录后再读取正文流程进度。\"}\n\n",
        {
          status: 401,
          headers: {
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-cache, no-transform",
            connection: "keep-alive"
          }
        }
      );
    }

    return new Response(
      `event: error\ndata: ${JSON.stringify({
        message: error instanceof Error ? error.message : "读取正文流程进度失败"
      })}\n\n`,
      {
        status: 500,
        headers: {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache, no-transform",
          connection: "keep-alive"
        }
      }
    );
  }
}

export async function GET(request: Request, context: RouteContext) {
  const { taskId } = await context.params;
  return handleTaskWorkflowStreamRequest(request, { taskId });
}

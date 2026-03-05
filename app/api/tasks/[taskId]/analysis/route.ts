import { NextResponse } from "next/server";
import { requireCurrentSessionUser } from "@/src/lib/auth/current-user";
import type { TaskWorkflowClassificationPayload } from "@/src/lib/tasks/request-task-file-upload";
import { buildAnalysisProgressPayload } from "@/src/lib/tasks/analysis-progress";
import {
  getOwnedTaskSummary,
  listTaskFilesForWorkflow
} from "@/src/lib/tasks/save-task-files";
import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import {
  toSessionTaskHumanizePayload,
  toSessionTaskPayload
} from "@/src/lib/tasks/session-task";
import type { OutlineScaffold } from "@/src/lib/ai/prompts/generate-outline";
import type { TaskAnalysisSnapshot } from "@/src/types/tasks";
import type { SessionUser } from "@/src/types/auth";

type RouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

type AnalysisRouteDependencies = {
  requireUser?: () => Promise<SessionUser>;
  isPersistenceReady?: () => boolean;
};

export async function handleTaskAnalysisStatusRequest(
  _request: Request,
  params: {
    taskId: string;
  },
  dependencies: AnalysisRouteDependencies = {}
) {
  try {
    if (!(dependencies.isPersistenceReady ?? shouldUseSupabasePersistence)()) {
      return NextResponse.json(
        {
          ok: false,
          message: "系统现在还没连上正式任务数据库，暂时无法读取分析进度。"
        },
        { status: 503 }
      );
    }

    const user = await (dependencies.requireUser ?? requireCurrentSessionUser)();
    const task = await getOwnedTaskSummary(params.taskId, user.id);

    if (!task) {
      return NextResponse.json(
        {
          ok: false,
          message: "没有找到这个任务，暂时不能读取分析进度。"
        },
        { status: 404 }
      );
    }

    const files = await listTaskFilesForWorkflow(params.taskId, user.id);
    const analysis = task.analysisSnapshot ?? null;
    const analysisStatus = task.analysisStatus ?? "pending";
    const analysisProgress = buildAnalysisProgressPayload({
      status: analysisStatus,
      requestedAt: task.analysisRequestedAt ?? null,
      startedAt: task.analysisStartedAt ?? null,
      completedAt: task.analysisCompletedAt ?? null
    });
    const outline = task.latestOutlineVersionId
      ? await getOutlineByVersionId(params.taskId, user.id, task.latestOutlineVersionId)
      : null;

    const ruleCard =
      analysisStatus === "succeeded" && analysis && !analysis.needsUserConfirmation
        ? buildRuleCardFromAnalysis(analysis, outline)
        : null;

    const classification = buildClassificationFromTask(task.primaryRequirementFileId ?? null, analysis);

    const message =
      analysisStatus === "pending" && analysisProgress.canRetry
        ? "系统已经开始分析你上传的文件，但这次等待超时了。你可以点“一键重试分析”，不用重新上传文件。"
        : analysisStatus === "pending"
          ? "系统正在后台分析你上传的文件，请稍等。"
        : analysisStatus === "failed"
          ? mapAnalysisFailureMessage(analysis)
          : analysis?.needsUserConfirmation
            ? "模型已阅读全部材料，但它认为主任务文件还需要你确认。"
            : "文件分析已完成，第一版大纲已就绪。";

    return NextResponse.json(
      {
        ok: true,
        task: toSessionTaskPayload(task),
        files,
        classification,
        analysisStatus,
        analysisProgress,
        analysis,
        ruleCard,
        outline: analysisStatus === "succeeded" ? outline : null,
        humanize: toSessionTaskHumanizePayload(task),
        message
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json(
        {
          ok: false,
          message: "请先登录后再查看分析进度。"
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "读取分析进度失败"
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request, context: RouteContext) {
  const { taskId } = await context.params;
  return handleTaskAnalysisStatusRequest(request, { taskId });
}

function buildClassificationFromTask(
  primaryRequirementFileId: string | null,
  analysis: TaskAnalysisSnapshot | null
): TaskWorkflowClassificationPayload {
  return {
    primaryRequirementFileId: analysis?.chosenTaskFileId ?? primaryRequirementFileId,
    backgroundFileIds: analysis?.supportingFileIds ?? [],
    irrelevantFileIds: analysis?.ignoredFileIds ?? [],
    needsUserConfirmation: analysis?.needsUserConfirmation ?? false,
    reasoning: analysis?.reasoning ?? "系统正在分析全部文件。"
  };
}

function buildRuleCardFromAnalysis(
  analysis: TaskAnalysisSnapshot,
  outline: OutlineScaffold | null
) {
  return {
    topic: analysis.topic ?? outline?.articleTitle ?? null,
    targetWordCount: analysis.targetWordCount,
    citationStyle: analysis.citationStyle,
    chapterCountOverride: analysis.chapterCount,
    mustAnswer: analysis.mustCover,
    gradingPriorities: analysis.gradingFocus,
    specialRequirements: analysis.appliedSpecialRequirements
  };
}

async function getOutlineByVersionId(
  taskId: string,
  userId: string,
  outlineVersionId: string
) {
  if (!shouldUseSupabasePersistence()) {
    const { getTaskOutlineVersion } = await import("@/src/lib/tasks/repository");
    return getTaskOutlineVersion(taskId, outlineVersionId)?.outline ?? null;
  }

  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("outline_versions")
    .select("english_outline")
    .eq("task_id", taskId)
    .eq("user_id", userId)
    .eq("id", outlineVersionId)
    .maybeSingle();

  if (error) {
    throw new Error(`读取大纲失败：${error.message}`);
  }

  if (!data?.english_outline) {
    return null;
  }

  if (typeof data.english_outline === "string") {
    return JSON.parse(data.english_outline) as OutlineScaffold;
  }

  return data.english_outline as OutlineScaffold;
}

function mapAnalysisFailureMessage(analysis: TaskAnalysisSnapshot | null) {
  const warning = analysis?.warnings?.find((item) => item.startsWith("analysis_failed:"));
  const code = warning?.replace("analysis_failed:", "")?.trim() ?? "";

  if (!code) {
    return "这次文件分析失败了，请重试一次上传。";
  }

  if (code === "MODEL_ANALYSIS_TIMEOUT") {
    return "系统已经开始分析你上传的文件，但本次处理超过等待上限。请直接点“一键重试分析”，不用重新上传。";
  }

  if (
    code === "MODEL_ANALYSIS_INCOMPLETE" ||
    code === "MODEL_ANALYSIS_INCOMPLETE_AFTER_RETRY" ||
    code === "MODEL_RETURNED_EMPTY_OUTLINE" ||
    code === "MODEL_RETURNED_EMPTY_OUTLINE_AFTER_RETRY"
  ) {
    return "系统已经读到你上传的文件，但模型这次返回内容不完整。请直接点“一键重试分析”，不用重新上传。";
  }

  if (code.startsWith("OpenAI request failed with status")) {
    return "模型服务暂时不稳定，请稍后再试。";
  }

  return "系统分析失败，请重试一次上传。如果连续失败，请联系人工支持。";
}

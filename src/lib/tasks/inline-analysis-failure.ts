import type { TaskAnalysisSnapshot } from "@/src/types/tasks";

type InlineAnalysisFailureInfo = {
  code: string;
  status: number;
  message: string;
};

const DEFAULT_FAILURE: InlineAnalysisFailureInfo = {
  code: "UNKNOWN_INLINE_ANALYSIS_FAILURE",
  status: 500,
  message: "系统没能完成这次分析，请直接再试一次，不用重新上传文件。"
};

export function resolveInlineAnalysisFailure(
  analysisErrorMessage: string | null | undefined,
  analysis: TaskAnalysisSnapshot | null
): InlineAnalysisFailureInfo {
  const warning = analysis?.warnings?.find((item) => item.startsWith("analysis_failed:"));
  const code =
    analysisErrorMessage?.trim() ||
    warning?.replace("analysis_failed:", "")?.trim() ||
    "";

  if (!code) {
    return DEFAULT_FAILURE;
  }

  if (code === "MODEL_INPUT_NOT_READY") {
    return {
      code,
      status: 400,
      message: "这次系统没把文件完整交给分析模型，所以没法开始生成大纲。"
    };
  }

  if (
    code === "MODEL_REQUIREMENTS_INCOMPLETE" ||
    code === "MODEL_REQUIREMENTS_INCOMPLETE_AFTER_RETRY" ||
    code === "MODEL_ANALYSIS_INCOMPLETE" ||
    code === "MODEL_ANALYSIS_INCOMPLETE_AFTER_RETRY"
  ) {
    return {
      code,
      status: 422,
      message: "系统已经读到文件，但这次没能稳定提取出完整写作要求。"
    };
  }

  if (
    code === "MODEL_OUTLINE_INCOMPLETE" ||
    code === "MODEL_OUTLINE_INCOMPLETE_AFTER_RETRY" ||
    code === "MODEL_RETURNED_EMPTY_OUTLINE" ||
    code === "MODEL_RETURNED_EMPTY_OUTLINE_AFTER_RETRY"
  ) {
    return {
      code,
      status: 422,
      message: "系统已经读懂了要求，但这次生成出来的大纲结构不完整。"
    };
  }

  if (code === "MODEL_ANALYSIS_TIMEOUT") {
    return {
      code,
      status: 502,
      message: "模型这次处理时间太长，请稍后再试。"
    };
  }

  if (
    code === "UPSTREAM_MODEL_UNAVAILABLE" ||
    code.startsWith("OpenAI request failed with status")
  ) {
    return {
      code,
      status: 502,
      message: "模型服务这次不稳定，请稍后再试。"
    };
  }

  if (code === "INLINE_ANALYSIS_DID_NOT_FINISH") {
    return {
      code,
      status: 500,
      message: "这次分析没有正常完成，请直接再试一次，不用重新上传文件。"
    };
  }

  return {
    ...DEFAULT_FAILURE,
    code
  };
}

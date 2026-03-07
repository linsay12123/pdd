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

  if (code === "MODEL_REQUIREMENTS_CONFLICTING") {
    return {
      code,
      status: 422,
      message: "系统已经读到文件，但不同材料里的要求彼此打架，这次没法安全判断该按哪个要求走。"
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

  if (code === "MODEL_RAW_RESPONSE_ONLY") {
    return {
      code,
      status: 422,
      message: "模型这次已经回了原始回复，但还没有形成正式大纲。你可以先看原始回复，再决定是否重试。"
    };
  }

  if (code === "PROVIDER_HTTP_ERROR") {
    return {
      code,
      status:
        typeof analysis?.providerStatusCode === "number" && Number.isFinite(analysis.providerStatusCode)
          ? analysis.providerStatusCode
          : 502,
      message: "上游接口返回了错误，下面是原始回复。"
    };
  }

  if (code === "PROVIDER_TRANSPORT_ERROR" || code === "MODEL_ANALYSIS_TIMEOUT") {
    return {
      code,
      status: 502,
      message: "上游接口这次没有返回可展示正文，请稍后再试。"
    };
  }

  if (
    code === "UPSTREAM_MODEL_UNAVAILABLE" ||
    code.startsWith("OpenAI request failed with status")
  ) {
    return {
      code,
      status: 502,
      message: "上游接口这次没有返回可展示正文，请稍后再试。"
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

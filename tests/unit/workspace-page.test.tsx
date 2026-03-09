import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkspacePageClient } from "../../src/components/pages/workspace-page-client";

describe("WorkspacePage", () => {
  it("renders the full single-page writing workspace sections", () => {
    const html = renderToStaticMarkup(<WorkspacePageClient initialQuota={1500} />);

    expect(html).toContain("工作台");
    expect(html).toContain("上传参考材料与要求文档");
    expect(html).toContain("补充特殊要求 (可选)");
    expect(html).toContain("系统会先分析材料并生成第一版大纲");
    expect(html).toContain("不会每30秒重复调用大模型");
    expect(html).toContain("任务进度");
    expect(html).toContain("大纲生成与确认");
    expect(html).toContain("字数校正");
    expect(html).toContain("导出交付");
    expect(html).toContain("积分兑换");
    expect(html).toContain('href="/billing"');
  });

  it("shows the model's raw reply and blocks formal outline approval when only raw fallback is available", () => {
    const html = renderToStaticMarkup(
      <WorkspacePageClient
        initialQuota={1500}
        initialActiveTask={{
          task: {
            id: "task-raw",
            status: "created",
            targetWordCount: null,
            citationStyle: null,
            specialRequirements: ""
          },
          files: [
            {
              id: "file-1",
              originalFilename: "brief.txt",
              role: "unknown",
              isPrimary: false
            }
          ],
          classification: {
            primaryRequirementFileId: null,
            needsUserConfirmation: false,
            reasoning: "模型有回复，但没形成正式大纲。"
          },
          analysisStatus: "failed",
          analysisProgress: {
            requestedAt: null,
            startedAt: null,
            completedAt: null,
            elapsedSeconds: 0,
            maxWaitSeconds: 600,
            canRetry: true
          },
          analysisRuntime: {
            state: "not_applicable",
            status: null,
            detail: "首版大纲这一步已经在当前请求里直接完成，不再走后台排队。",
            autoRecovered: false,
            runId: null
          },
          analysis: {
            chosenTaskFileId: null,
            supportingFileIds: [],
            ignoredFileIds: [],
            needsUserConfirmation: false,
            reasoning: "模型有回复，但没形成正式大纲。",
            targetWordCount: 2000,
            citationStyle: "APA 7",
            topic: null,
            chapterCount: null,
            mustCover: [],
            gradingFocus: [],
            appliedSpecialRequirements: "",
            usedDefaultWordCount: true,
            usedDefaultCitationStyle: true,
            warnings: [],
            analysisRenderMode: "raw_model",
            rawModelResponse: "Suggested structure:\n1. Introduction\n2. Governance framework",
            providerStatusCode: null,
            providerErrorBody: null,
            providerErrorKind: null
          },
          analysisRenderMode: "raw_model",
          rawModelResponse: "Suggested structure:\n1. Introduction\n2. Governance framework",
          providerStatusCode: null,
          providerErrorBody: null,
          providerErrorKind: null,
          ruleCard: null,
          outline: null,
          humanize: {
            status: "idle",
            provider: "undetectable",
            requestedAt: null,
            completedAt: null,
            errorMessage: null
          },
          message: "系统先把模型原始回复展示出来。"
        } as any}
      />
    );

    expect(html).toContain("模型原始回复");
    expect(html).toContain("Suggested structure:");
    expect(html).toContain("这次还没有形成正式大纲");
    expect(html).toContain("一键重试分析");
    expect(html).not.toContain("确认大纲并生成正文");
  });

  it("shows the upstream raw error body when the provider returns an http error body", () => {
    const html = renderToStaticMarkup(
      <WorkspacePageClient
        initialQuota={1500}
        initialActiveTask={{
          task: {
            id: "task-upstream",
            status: "created",
            targetWordCount: null,
            citationStyle: null,
            specialRequirements: ""
          },
          files: [],
          classification: {
            primaryRequirementFileId: null,
            needsUserConfirmation: false,
            reasoning: "模型服务挂了。"
          },
          analysisStatus: "failed",
          analysisProgress: {
            requestedAt: null,
            startedAt: null,
            completedAt: null,
            elapsedSeconds: 0,
            maxWaitSeconds: 600,
            canRetry: true
          },
          analysisRuntime: {
            state: "not_applicable",
            status: null,
            detail: "首版大纲这一步已经在当前请求里直接完成，不再走后台排队。",
            autoRecovered: false,
            runId: null
          },
          analysis: {
            chosenTaskFileId: null,
            supportingFileIds: [],
            ignoredFileIds: [],
            needsUserConfirmation: false,
            reasoning: "上游接口返回了错误正文。",
            targetWordCount: 2000,
            citationStyle: "APA 7",
            topic: null,
            chapterCount: null,
            mustCover: [],
            gradingFocus: [],
            appliedSpecialRequirements: "",
            usedDefaultWordCount: true,
            usedDefaultCitationStyle: true,
            warnings: [],
            analysisRenderMode: "raw_provider_error",
            rawModelResponse: null,
            providerStatusCode: 502,
            providerErrorBody: '{"error":{"message":"bad gateway from upstream"}}',
            providerErrorKind: "http_error"
          },
          analysisRenderMode: "raw_provider_error",
          rawModelResponse: null,
          providerStatusCode: 502,
          providerErrorBody: '{"error":{"message":"bad gateway from upstream"}}',
          providerErrorKind: "http_error",
          ruleCard: null,
          outline: null,
          humanize: {
            status: "idle",
            provider: "undetectable",
            requestedAt: null,
            completedAt: null,
            errorMessage: null
          },
          message: "上游接口返回了错误，下面是原始回复。"
        } as any}
      />
    );

    expect(html).toContain("上游接口原始报错");
    expect(html).toContain("HTTP 502");
    expect(html).toContain("bad gateway from upstream");
    expect(html).toContain("一键重试分析");
    expect(html).not.toContain("确认大纲并生成正文");
  });

  it("shows invalid_json_schema as a system request-format bug and stops encouraging retries", () => {
    const providerErrorBody = JSON.stringify({
      error: {
        message:
          "Invalid schema for response_format 'task_analysis_and_outline_result': missing required targetWordCount",
        type: "invalid_request_error",
        param: "text.format.schema",
        code: "invalid_json_schema"
      }
    });

    const html = renderToStaticMarkup(
      <WorkspacePageClient
        initialQuota={1500}
        initialActiveTask={{
          task: {
            id: "task-invalid-json-schema",
            status: "created",
            targetWordCount: null,
            citationStyle: null,
            specialRequirements: ""
          },
          files: [],
          classification: {
            primaryRequirementFileId: null,
            needsUserConfirmation: false,
            reasoning: "这次不是文件问题，是系统请求格式写错了。"
          },
          analysisStatus: "failed",
          analysisProgress: {
            requestedAt: null,
            startedAt: null,
            completedAt: null,
            elapsedSeconds: 0,
            maxWaitSeconds: 600,
            canRetry: true
          },
          analysisRuntime: {
            state: "not_applicable",
            status: null,
            detail: "首版大纲这一步已经在当前请求里直接完成，不再走后台排队。",
            autoRecovered: false,
            runId: null
          },
          analysis: {
            chosenTaskFileId: null,
            supportingFileIds: [],
            ignoredFileIds: [],
            needsUserConfirmation: false,
            reasoning: "这次不是文件问题，是系统请求格式写错了。",
            targetWordCount: 2000,
            citationStyle: "APA 7",
            topic: null,
            chapterCount: null,
            mustCover: [],
            gradingFocus: [],
            appliedSpecialRequirements: "",
            usedDefaultWordCount: true,
            usedDefaultCitationStyle: true,
            warnings: [],
            analysisRenderMode: "raw_provider_error",
            rawModelResponse: null,
            providerStatusCode: 400,
            providerErrorBody,
            providerErrorKind: "http_error"
          },
          analysisRenderMode: "raw_provider_error",
          rawModelResponse: null,
          providerStatusCode: 400,
          providerErrorBody,
          providerErrorKind: "http_error",
          ruleCard: null,
          outline: null,
          humanize: {
            status: "idle",
            provider: "undetectable",
            requestedAt: null,
            completedAt: null,
            errorMessage: null
          },
          message: "这次不是你的文件有问题，是系统发给上游接口的格式说明写错了。下面是原始报错。"
        } as any}
      />
    );

    expect(html).toContain("系统请求格式写错了");
    expect(html).toContain("不是你的文件问题");
    expect(html).toContain("invalid_json_schema");
    expect(html).not.toContain("一键重试分析");
    expect(html).not.toContain("确认大纲并生成正文");
  });

  it("falls back to the generic system error card when the provider failed without any raw body", () => {
    const html = renderToStaticMarkup(
      <WorkspacePageClient
        initialQuota={1500}
        initialActiveTask={{
          task: {
            id: "task-provider-timeout",
            status: "created",
            targetWordCount: null,
            citationStyle: null,
            specialRequirements: ""
          },
          files: [],
          classification: {
            primaryRequirementFileId: null,
            needsUserConfirmation: false,
            reasoning: "上游接口这次没有返回可展示正文。"
          },
          analysisStatus: "failed",
          analysisProgress: {
            requestedAt: null,
            startedAt: null,
            completedAt: null,
            elapsedSeconds: 0,
            maxWaitSeconds: 600,
            canRetry: true
          },
          analysisRuntime: {
            state: "not_applicable",
            status: null,
            detail: "首版大纲这一步已经在当前请求里直接完成，不再走后台排队。",
            autoRecovered: false,
            runId: null
          },
          analysis: {
            chosenTaskFileId: null,
            supportingFileIds: [],
            ignoredFileIds: [],
            needsUserConfirmation: false,
            reasoning: "上游接口这次没有返回可展示正文。",
            targetWordCount: 2000,
            citationStyle: "APA 7",
            topic: null,
            chapterCount: null,
            mustCover: [],
            gradingFocus: [],
            appliedSpecialRequirements: "",
            usedDefaultWordCount: true,
            usedDefaultCitationStyle: true,
            warnings: [],
            analysisRenderMode: "system_error",
            rawModelResponse: null,
            providerStatusCode: null,
            providerErrorBody: null,
            providerErrorKind: "timeout"
          },
          analysisRenderMode: "system_error",
          rawModelResponse: null,
          providerStatusCode: null,
          providerErrorBody: null,
          providerErrorKind: "timeout",
          ruleCard: null,
          outline: null,
          humanize: {
            status: "idle",
            provider: "undetectable",
            requestedAt: null,
            completedAt: null,
            errorMessage: null
          },
          message: "上游接口这次没有返回可展示正文，请稍后再试。"
        } as any}
      />
    );

    expect(html).toContain("上游接口这次没有返回可展示正文");
    expect(html).toContain("一键重试分析");
    expect(html).not.toContain("HTTP 502");
  });

  it("shows a dedicated file-not-ready card when files never reached the model", () => {
    const html = renderToStaticMarkup(
      <WorkspacePageClient
        initialQuota={1500}
        initialActiveTask={{
          task: {
            id: "task-input-not-ready",
            status: "created",
            targetWordCount: null,
            citationStyle: null,
            specialRequirements: ""
          },
          files: [],
          classification: {
            primaryRequirementFileId: null,
            needsUserConfirmation: false,
            reasoning: "文件还没准备好。"
          },
          analysisStatus: "failed",
          analysisProgress: {
            requestedAt: null,
            startedAt: null,
            completedAt: null,
            elapsedSeconds: 0,
            maxWaitSeconds: 600,
            canRetry: true
          },
          analysisRuntime: {
            state: "not_applicable",
            status: null,
            detail: "首版大纲这一步已经在当前请求里直接完成，不再走后台排队。",
            autoRecovered: false,
            runId: null
          },
          analysis: null,
          analysisRenderMode: null,
          rawModelResponse: null,
          ruleCard: null,
          outline: null,
          humanize: {
            status: "idle",
            provider: "undetectable",
            requestedAt: null,
            completedAt: null,
            errorMessage: null
          },
          message: "这次系统没把文件完整交给分析模型，所以没法开始生成大纲。"
        } as any}
      />
    );

    expect(html).toContain("文件还没真正交给模型");
    expect(html).toContain("没法开始生成大纲");
    expect(html).toContain("一键重试分析");
    expect(html).not.toContain("系统没能完成这次分析");
  });

  it("uses a darker warning color so analysis reminders stay readable", () => {
    const html = renderToStaticMarkup(
      <WorkspacePageClient
        initialQuota={1500}
        initialActiveTask={{
          task: {
            id: "task-warning-style",
            status: "created",
            targetWordCount: 1000,
            citationStyle: "APA 7",
            specialRequirements: ""
          },
          files: [
            {
              id: "file-1",
              originalFilename: "brief.pdf",
              role: "task_requirement",
              isPrimary: true
            }
          ],
          classification: {
            primaryRequirementFileId: "file-1",
            needsUserConfirmation: false,
            reasoning: "模型已找到主任务文件。"
          },
          analysisStatus: "succeeded",
          analysisProgress: {
            requestedAt: null,
            startedAt: null,
            completedAt: null,
            elapsedSeconds: 0,
            maxWaitSeconds: 600,
            canRetry: false
          },
          analysisRuntime: {
            state: "not_applicable",
            status: null,
            detail: "首版大纲已经生成完成。",
            autoRecovered: false,
            runId: null
          },
          analysis: {
            chosenTaskFileId: "file-1",
            supportingFileIds: [],
            ignoredFileIds: [],
            needsUserConfirmation: false,
            reasoning: "模型已经完成分析。",
            targetWordCount: 1000,
            citationStyle: "APA 7",
            topic: "Sample Topic",
            chapterCount: 3,
            mustCover: [],
            gradingFocus: [],
            appliedSpecialRequirements: "",
            usedDefaultWordCount: false,
            usedDefaultCitationStyle: false,
            warnings: [
              "Topic is self-selected; ensure it aligns with your existing extended project topic."
            ],
            analysisRenderMode: "structured",
            rawModelResponse: null,
            providerStatusCode: null,
            providerErrorBody: null,
            providerErrorKind: null
          },
          analysisRenderMode: "structured",
          rawModelResponse: null,
          providerStatusCode: null,
          providerErrorBody: null,
          providerErrorKind: null,
          ruleCard: null,
          outline: {
            articleTitle: "Sample Topic",
            sections: [
              {
                title: "Introduction",
                summary: "Summary",
                bulletPoints: ["Point 1", "Point 2", "Point 3"]
              }
            ]
          },
          humanize: {
            status: "idle",
            provider: "undetectable",
            requestedAt: null,
            completedAt: null,
            errorMessage: null
          },
          message: null
        } as any}
      />
    );

    expect(html).toContain("border-amber-500/60 bg-amber-100");
    expect(html).toContain("text-amber-950");
  });

  it("shows the drafting stage instead of jumping straight to the download screen", () => {
    const html = renderToStaticMarkup(
      <WorkspacePageClient
        initialQuota={1500}
        initialActiveTask={{
          task: {
            id: "task-drafting",
            status: "drafting",
            targetWordCount: 1000,
            citationStyle: "Harvard",
            specialRequirements: "Use strong critical analysis."
          },
          files: [],
          classification: {
            primaryRequirementFileId: "file-1",
            needsUserConfirmation: false
          },
          analysisStatus: "succeeded",
          analysisProgress: {
            requestedAt: null,
            startedAt: null,
            completedAt: null,
            elapsedSeconds: 0,
            maxWaitSeconds: 600,
            canRetry: false
          },
          analysisRuntime: {
            state: "not_applicable",
            status: null,
            detail: "done",
            autoRecovered: false,
            runId: null
          },
          analysis: null,
          analysisRenderMode: "structured",
          rawModelResponse: null,
          providerStatusCode: null,
          providerErrorBody: null,
          providerErrorKind: null,
          ruleCard: null,
          outline: {
            articleTitle: "Sample title",
            targetWordCount: 1000,
            citationStyle: "Harvard",
            chineseMirrorPending: true,
            sections: [
              {
                title: "Introduction",
                summary: "Intro",
                bulletPoints: ["a", "b", "c"]
              }
            ]
          },
          downloads: {
            finalDocxOutputId: null,
            referenceReportOutputId: null,
            humanizedDocxOutputId: null
          },
          humanize: {
            status: "idle",
            provider: "undetectable",
            requestedAt: null,
            completedAt: null,
            errorMessage: null
          },
          message: "系统已进入正文写作。"
        } as any}
      />
    );

    expect(html).toContain("正文写作中");
    expect(html).toContain("系统正在根据你确认的大纲一次性写完整篇文章");
    expect(html).toContain("字数校正");
    expect(html).not.toContain("任务已完成");
    expect(html).not.toContain("下载文档");
  });

  it("shows the word-count adjustment and reference verification stages from real task statuses", () => {
    const adjustingHtml = renderToStaticMarkup(
      <WorkspacePageClient
        initialQuota={1500}
        initialActiveTask={{
          task: {
            id: "task-adjusting",
            status: "adjusting_word_count",
            targetWordCount: 1000,
            citationStyle: "Harvard",
            specialRequirements: ""
          },
          files: [],
          classification: {
            primaryRequirementFileId: "file-1",
            needsUserConfirmation: false
          },
          analysisStatus: "succeeded",
          analysisProgress: {
            requestedAt: null,
            startedAt: null,
            completedAt: null,
            elapsedSeconds: 0,
            maxWaitSeconds: 600,
            canRetry: false
          },
          analysis: null,
          analysisRenderMode: "structured",
          rawModelResponse: null,
          providerStatusCode: null,
          providerErrorBody: null,
          providerErrorKind: null,
          ruleCard: null,
          outline: null,
          downloads: {
            finalDocxOutputId: null,
            referenceReportOutputId: null,
            humanizedDocxOutputId: null
          },
          humanize: {
            status: "idle",
            provider: "undetectable",
            requestedAt: null,
            completedAt: null,
            errorMessage: null
          },
          message: "系统正在校正正文部分字数。"
        } as any}
      />
    );

    expect(adjustingHtml).toContain("字数校正中");
    expect(adjustingHtml).toContain("系统正在把正文部分校正到目标字数的正负 10 以内");
    expect(adjustingHtml).not.toContain("任务已完成");

    const verifyingHtml = renderToStaticMarkup(
      <WorkspacePageClient
        initialQuota={1500}
        initialActiveTask={{
          task: {
            id: "task-verifying",
            status: "verifying_references",
            targetWordCount: 1000,
            citationStyle: "Harvard",
            specialRequirements: ""
          },
          files: [],
          classification: {
            primaryRequirementFileId: "file-1",
            needsUserConfirmation: false
          },
          analysisStatus: "succeeded",
          analysisProgress: {
            requestedAt: null,
            startedAt: null,
            completedAt: null,
            elapsedSeconds: 0,
            maxWaitSeconds: 600,
            canRetry: false
          },
          analysis: null,
          analysisRenderMode: "structured",
          rawModelResponse: null,
          providerStatusCode: null,
          providerErrorBody: null,
          providerErrorKind: null,
          ruleCard: null,
          outline: null,
          downloads: {
            finalDocxOutputId: null,
            referenceReportOutputId: null,
            humanizedDocxOutputId: null
          },
          humanize: {
            status: "idle",
            provider: "undetectable",
            requestedAt: null,
            completedAt: null,
            errorMessage: null
          },
          message: "系统正在核验引用。"
        } as any}
      />
    );

    expect(verifyingHtml).toContain("引用核验中");
    expect(verifyingHtml).toContain("系统正在逐条核对参考文献与来源链接");
    expect(verifyingHtml).not.toContain("任务已完成");
  });

  it("shows a failed writing-stage card instead of pretending the task is complete", () => {
    const html = renderToStaticMarkup(
      <WorkspacePageClient
        initialQuota={1500}
        initialActiveTask={{
          task: {
            id: "task-writing-failed",
            status: "failed",
            targetWordCount: 1000,
            citationStyle: "Harvard",
            specialRequirements: "",
            lastWorkflowStage: "verifying_references"
          },
          files: [],
          classification: {
            primaryRequirementFileId: "file-1",
            needsUserConfirmation: false
          },
          analysisStatus: "succeeded",
          analysisProgress: {
            requestedAt: null,
            startedAt: null,
            completedAt: null,
            elapsedSeconds: 0,
            maxWaitSeconds: 600,
            canRetry: false
          },
          analysis: null,
          analysisRenderMode: "structured",
          rawModelResponse: null,
          providerStatusCode: null,
          providerErrorBody: null,
          providerErrorKind: null,
          ruleCard: null,
          outline: null,
          downloads: {
            finalDocxOutputId: null,
            referenceReportOutputId: null,
            humanizedDocxOutputId: null
          },
          humanize: {
            status: "idle",
            provider: "undetectable",
            requestedAt: null,
            completedAt: null,
            errorMessage: null
          },
          message: "正文流水线失败，请重新开始正文生成。"
        } as any}
      />
    );

    expect(html).toContain("正文生成失败");
    expect(html).toContain("重新开始正文生成");
    expect(html).toContain("引用核验");
    expect(html).not.toContain("任务已完成");
    expect(html).not.toContain("下载文档");
  });

  it("shows the real workflow failure reason when the backend task never actually starts", () => {
    const html = renderToStaticMarkup(
      <WorkspacePageClient
        initialQuota={1500}
        initialActiveTask={{
          task: {
            id: "task-writing-startup-failed",
            status: "failed",
            targetWordCount: 1000,
            citationStyle: "Harvard",
            specialRequirements: "",
            lastWorkflowStage: "drafting",
            workflowErrorMessage: "后台正文任务版本还没准备好，请稍后重试。"
          },
          files: [],
          classification: {
            primaryRequirementFileId: "file-1",
            needsUserConfirmation: false
          },
          analysisStatus: "succeeded",
          analysisProgress: {
            requestedAt: null,
            startedAt: null,
            completedAt: null,
            elapsedSeconds: 0,
            maxWaitSeconds: 600,
            canRetry: false
          },
          analysis: null,
          analysisRenderMode: "structured",
          rawModelResponse: null,
          providerStatusCode: null,
          providerErrorBody: null,
          providerErrorKind: null,
          ruleCard: null,
          outline: null,
          downloads: {
            finalDocxOutputId: null,
            referenceReportOutputId: null,
            humanizedDocxOutputId: null
          },
          humanize: {
            status: "idle",
            provider: "undetectable",
            requestedAt: null,
            completedAt: null,
            errorMessage: null
          },
          message: "后台正文任务版本还没准备好，请稍后重试。"
        } as any}
      />
    );

    expect(html).toContain("正文生成失败");
    expect(html).toContain("后台正文任务版本还没准备好，请稍后重试。");
    expect(html).not.toContain("任务已完成");
  });

  it("shows the completed stage history before the download area when the task already finished", () => {
    const html = renderToStaticMarkup(
      <WorkspacePageClient
        initialQuota={1500}
        initialActiveTask={{
          task: {
            id: "task-finished-with-history",
            status: "deliverable_ready",
            targetWordCount: 1000,
            citationStyle: "Harvard",
            specialRequirements: "",
            lastWorkflowStage: "exporting",
            workflowStageTimestamps: {
              drafting: "2026-03-09T10:00:00.000Z",
              adjusting_word_count: "2026-03-09T10:05:00.000Z",
              verifying_references: "2026-03-09T10:08:00.000Z",
              exporting: "2026-03-09T10:12:00.000Z",
              deliverable_ready: "2026-03-09T10:14:00.000Z"
            }
          },
          files: [],
          classification: {
            primaryRequirementFileId: "file-1",
            needsUserConfirmation: false
          },
          analysisStatus: "succeeded",
          analysisProgress: {
            requestedAt: null,
            startedAt: null,
            completedAt: null,
            elapsedSeconds: 0,
            maxWaitSeconds: 600,
            canRetry: false
          },
          analysis: null,
          analysisRenderMode: "structured",
          rawModelResponse: null,
          providerStatusCode: null,
          providerErrorBody: null,
          providerErrorKind: null,
          ruleCard: null,
          outline: null,
          downloads: {
            finalDocxOutputId: "docx-1",
            referenceReportOutputId: "pdf-1",
            humanizedDocxOutputId: null
          },
          finalWordCount: 1001,
          humanize: {
            status: "idle",
            provider: "undetectable",
            requestedAt: null,
            completedAt: null,
            errorMessage: null
          },
          message: "任务已完成。"
        } as any}
      />
    );

    expect(html).toContain("已完成阶段");
    expect(html).toContain("正文写作");
    expect(html).toContain("字数校正");
    expect(html).toContain("引用核验");
    expect(html).toContain("导出生成");
    expect(html).toContain("下载文档");
  });
});

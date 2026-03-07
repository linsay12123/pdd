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
    expect(html).toContain("交付与降AI");
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
});

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

  it("warns when the active failed task came from an older first-outline flow", () => {
    const html = renderToStaticMarkup(
      <WorkspacePageClient
        initialQuota={1500}
        initialActiveTask={{
          task: {
            id: "task-legacy",
            status: "created",
            targetWordCount: null,
            citationStyle: null,
            specialRequirements: ""
          },
          files: [],
          classification: {
            primaryRequirementFileId: null,
            needsUserConfirmation: false,
            reasoning: "旧版本任务"
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
            detail: "旧版本任务",
            autoRecovered: false,
            runId: null
          },
          analysis: null,
          ruleCard: null,
          outline: null,
          humanize: {
            status: "idle",
            provider: "undetectable",
            requestedAt: null,
            completedAt: null,
            errorMessage: null
          },
          message: "旧任务失败"
        }}
      />
    );

    expect(html).toContain("一键重试分析");
  });
});

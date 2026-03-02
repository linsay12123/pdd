import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import WorkspacePage from "../../app/(app)/workspace/page";

describe("WorkspacePage", () => {
  it("renders the full single-page writing workspace sections", () => {
    const html = renderToStaticMarkup(<WorkspacePage />);

    expect(html).toContain("工作台");
    expect(html).toContain("上传参考材料与要求文档");
    expect(html).toContain("补充特殊要求 (可选)");
    expect(html).toContain("500 积分");
    expect(html).toContain("任务进度");
    expect(html).toContain("大纲生成与确认");
    expect(html).toContain("交付与降AI");
  });
});

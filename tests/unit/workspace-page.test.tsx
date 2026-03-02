import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import WorkspacePage from "../../app/(app)/workspace/page";

describe("WorkspacePage", () => {
  it("renders the full single-page writing workspace sections", () => {
    const html = renderToStaticMarkup(<WorkspacePage />);

    expect(html).toContain("上传任务文件");
    expect(html).toContain("特殊要求");
    expect(html).toContain("预计消耗额度");
    expect(html).toContain("当前进度");
    expect(html).toContain("英文大纲");
    expect(html).toContain("交付结果");
  });
});

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import TasksPage from "../../app/(app)/tasks/page";

describe("TasksPage", () => {
  it("renders the branded task history page", () => {
    const html = renderToStaticMarkup(<TasksPage />);

    expect(html).toContain("我的任务");
    expect(html).toContain("消耗积分");
    expect(html).toContain("重新处理");
  });
});

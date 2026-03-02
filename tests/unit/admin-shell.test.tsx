import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AdminPage from "../../app/(app)/admin/page";

describe("AdminPage", () => {
  it("renders the operator dashboard sections", () => {
    const html = renderToStaticMarkup(<AdminPage />);

    expect(html).toContain("运营中控后台");
    expect(html).toContain("用户管理");
    expect(html).toContain("订单管理");
    expect(html).toContain("任务管理");
    expect(html).toContain("文件管理");
    expect(html).toContain("价格策略");
    expect(html).toContain("财务总览");
    expect(html).toContain("冻结用户");
    expect(html).toContain("重试任务");
  });
});

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AdminPage from "../../app/(app)/admin/page";

describe("AdminPage", () => {
  it("renders the operator dashboard sections", () => {
    const html = renderToStaticMarkup(<AdminPage />);

    expect(html).toContain("运营中控后台");
    expect(html).toContain("用户管理");
    expect(html).toContain("激活码管理");
    expect(html).toContain("筛选状态");
    expect(html).toContain("导出CSV");
    expect(html).toContain("复制全部");
    expect(html).toContain("任务管理");
    expect(html).toContain("文件管理");
    expect(html).toContain("积分规则");
    expect(html).toContain("财务总览");
    expect(html).toContain("生成新激活码");
    expect(html).toContain("手动加积分");
    expect(html).toContain("重试任务");
  });
});

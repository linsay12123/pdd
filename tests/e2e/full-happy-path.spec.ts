import { expect, test } from "@playwright/test";

test("seeded workspace preview shows the full delivery flow", async ({
  page,
  context
}) => {
  await context.addCookies([
    {
      name: "sb-test-auth-token",
      value: "present",
      domain: "127.0.0.1",
      path: "/"
    }
  ]);

  await page.goto("/workspace/demo");

  await expect(
    page.getByRole("heading", { level: 1, name: "完整流程演示" })
  ).toBeVisible();
  await expect(page.getByText("上传任务文件")).toBeVisible();
  await expect(page.getByText("英文大纲")).toBeVisible();
  await expect(page.getByText("最终版文章（Word）")).toBeVisible();
  await expect(page.getByRole("button", { name: "自动降AI" })).toBeVisible();
  await expect(page.getByText("降AI后版本（Word）")).toBeVisible();
  await expect(page.getByText("人工降ai 请联系客服")).toBeVisible();
});

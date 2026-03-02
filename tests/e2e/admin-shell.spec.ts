import { expect, test } from "@playwright/test";

test("non-admin is redirected away from admin", async ({ page, context }) => {
  await context.addCookies([
    {
      name: "sb-test-auth-token",
      value: "present",
      domain: "127.0.0.1",
      path: "/"
    },
    {
      name: "aw-role",
      value: "user",
      domain: "127.0.0.1",
      path: "/"
    }
  ]);

  await page.goto("/admin");

  await expect(page).toHaveURL(/\/workspace$/);
});

test("admin can open the admin dashboard", async ({ page, context }) => {
  await context.addCookies([
    {
      name: "sb-test-auth-token",
      value: "present",
      domain: "127.0.0.1",
      path: "/"
    },
    {
      name: "aw-role",
      value: "admin",
      domain: "127.0.0.1",
      path: "/"
    }
  ]);

  await page.goto("/admin");

  await expect(
    page.getByRole("heading", { level: 1, name: "运营中控后台" })
  ).toBeVisible();
});

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

describe("Admin dashboard shell", () => {
  it("keeps the homepage-style admin sections in one dashboard view", async () => {
    const [{ UserTableView }, { ActivationCodePanel }, { TaskTableView }, { FileTableView }, { PricingEditorView }, { FinanceSummaryView }] = await Promise.all([
      import("../../src/components/admin/user-table"),
      import("../../src/components/admin/activation-code-panel"),
      import("../../src/components/admin/task-table"),
      import("../../src/components/admin/file-table"),
      import("../../src/components/admin/pricing-editor"),
      import("../../src/components/admin/finance-summary")
    ]);

    const html = renderToStaticMarkup(
      <div>
        <section>
          <h2>运营中控后台</h2>
          <p>这里是后台总览。你可以直接在下面查看用户、激活码、任务、文件、积分规则和财务。</p>
        </section>
        <UserTableView
          users={[
            {
              id: "user-1",
              email: "owner@example.com",
              displayName: "管理员账号",
              role: "admin",
              status: "active",
              currentQuota: 9000,
              rechargeQuota: 9000,
              subscriptionQuota: 0,
              frozenQuota: 0,
              createdAt: "2026-03-03T09:00:00.000Z"
            }
          ]}
        />
        <ActivationCodePanel />
        <TaskTableView
          tasks={[
            {
              id: "task-1",
              userId: "user-1",
              userEmail: "owner@example.com",
              userDisplayName: "管理员账号",
              title: "Business Ethics Essay",
              status: "deliverable_ready",
              targetWordCount: 2000,
              citationStyle: "APA 7",
              outlineRevisionCount: 2,
              createdAt: "2026-03-03T10:00:00.000Z",
              expiresAt: "2026-03-06T10:00:00.000Z"
            }
          ]}
        />
        <FileTableView
          files={[
            {
              id: "output-1",
              taskId: "task-1",
              userId: "user-1",
              taskTitle: "Business Ethics Essay",
              outputKind: "final_docx",
              outputLabel: "最终版 Word",
              userEmail: "owner@example.com",
              userDisplayName: "管理员账号",
              createdAt: "2026-03-03T10:30:00.000Z",
              expiresAt: "2026-03-06T10:30:00.000Z",
              status: "active"
            }
          ]}
        />
        <PricingEditorView
          rules={[
            {
              id: "generation",
              title: "生成文章",
              quotaCost: 500,
              description: "每次创建写作任务都会扣这一笔积分。",
              note: "当前固定规则：每次生成文章都扣同样的积分。"
            },
            {
              id: "humanize",
              title: "自动降AI",
              quotaCost: 500,
              description: "每次降AI任务都会扣这一笔积分。",
              note: "现在先保留固定扣点说明。"
            }
          ]}
        />
        <FinanceSummaryView
          rows={[
            { label: "今日发出的激活码", value: "3 个" },
            { label: "今日已兑换激活码", value: "2 个" },
            { label: "今日消耗额度", value: "1500 点" }
          ]}
        />
      </div>
    );

    expect(html).toContain("运营中控后台");
    expect(html).toContain("用户管理");
    expect(html).toContain("激活码管理");
    expect(html).toContain("导出CSV");
    expect(html).toContain("任务管理");
    expect(html).toContain("文件管理");
    expect(html).toContain("积分规则");
    expect(html).toContain("财务总览");
    expect(html).toContain("生成新激活码");
    expect(html).toContain("当前固定扣点");
    expect(html).not.toContain("client-a@example.com");
  });
});

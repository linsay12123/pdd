import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkspacePageClient } from "../../src/components/pages/workspace-page-client";
import { BillingPageClient } from "../../src/components/pages/billing-page-client";

describe("app balance pages", () => {
  it("renders workspace with the live quota passed from the session", () => {
    const html = renderToStaticMarkup(<WorkspacePageClient initialQuota={3200} />);

    expect(html).toContain("当前积分");
    expect(html).toContain("3,200");
    expect(html).not.toContain("1,500");
  });

  it("renders billing page with the live quota passed from the session", () => {
    const html = renderToStaticMarkup(
      <BillingPageClient
        initialQuota={8800}
        initialLedger={[
          {
            id: "entry-1",
            kind: "activation_credit",
            title: "激活码兑换",
            detail: "额度激活码兑换成功",
            amount: 5000,
            createdAt: "2026-03-03T10:00:00.000Z"
          }
        ]}
      />
    );

    expect(html).toContain("当前可用积分");
    expect(html).toContain("8,800");
    expect(html).not.toContain("1,500");
    expect(html).toContain("激活码兑换");
    expect(html).not.toContain("2023-10-25 14:30");
  });
});

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import BillingPage from "../../app/(app)/billing/page";
import RechargePage from "../../app/recharge/page";

describe("BillingPage", () => {
  it("shows the activation-code quota center", () => {
    const html = renderToStaticMarkup(<BillingPage />);

    expect(html).toContain("额度激活码");
    expect(html).toContain("立即兑换激活码");
    expect(html).toContain("兑换状态");
    expect(html).toContain("1000 积分");
    expect(html).toContain("生成文章固定扣 500 积分");
    expect(html).not.toContain("支付宝");
    expect(html).not.toContain("微信支付");
    expect(html).not.toContain("USDC");
  });

  it("exposes the recharge alias page", () => {
    const html = renderToStaticMarkup(<RechargePage />);

    expect(html).toContain("额度激活码");
  });
});

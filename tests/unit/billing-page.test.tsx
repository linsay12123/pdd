import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import BillingPage from "../../app/(app)/billing/page";
import RechargePage from "../../app/recharge/page";

describe("BillingPage", () => {
  it("shows the activation-code quota center", () => {
    const html = renderToStaticMarkup(<BillingPage />);

    expect(html).toContain("激活码兑换");
    expect(html).toContain("立即兑换");
    expect(html).toContain("最近记录");
    expect(html).toContain("1000、5000、10000、20000");
    expect(html).toContain("500</span> 积分/次");
    expect(html).not.toContain("支付宝");
    expect(html).not.toContain("微信支付");
    expect(html).not.toContain("USDC");
  });

  it("exposes the recharge alias page", () => {
    const html = renderToStaticMarkup(<RechargePage />);

    expect(html).toContain("额度激活码");
  });
});

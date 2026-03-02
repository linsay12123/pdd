import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import BillingPage from "../../app/(app)/billing/page";

describe("BillingPage", () => {
  it("shows only crypto, alipay, and wechat payment options", () => {
    const html = renderToStaticMarkup(<BillingPage />);

    expect(html).toContain("USDC（Solana / Ethereum / TRON）");
    expect(html).toContain("支付宝");
    expect(html).toContain("微信支付");
    expect(html).not.toContain("Stripe");
  });
});

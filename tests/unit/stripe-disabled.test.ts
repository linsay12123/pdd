import { describe, expect, it } from "vitest";
import { POST as createStripeCheckout } from "../../app/api/payments/stripe/create-checkout/route";
import { POST as receiveStripeWebhook } from "../../app/api/payments/stripe/webhook/route";

describe("stripe routes", () => {
  it("rejects new checkout requests because stripe is disabled", async () => {
    const response = await createStripeCheckout(
      new Request("http://localhost/api/payments/stripe/create-checkout", {
        method: "POST",
        body: JSON.stringify({
          userId: "user-1",
          packageId: "recharge-starter",
          successUrl: "https://example.com/success",
          cancelUrl: "https://example.com/cancel"
        }),
        headers: {
          "content-type": "application/json"
        }
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(410);
    expect(payload.message).toContain("已关闭");
  });

  it("rejects stripe webhooks because stripe is disabled", async () => {
    const response = await receiveStripeWebhook(
      new Request("http://localhost/api/payments/stripe/webhook", {
        method: "POST",
        body: JSON.stringify({ id: "evt_1" }),
        headers: {
          "content-type": "application/json"
        }
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(410);
    expect(payload.message).toContain("已关闭");
  });
});

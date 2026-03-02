import { describe, expect, it } from "vitest";
import { POST as createCryptoOrder } from "../../app/api/payments/crypto/create-order/route";
import { POST as createAlipayOrder } from "../../app/api/payments/alipay/create-order/route";
import { POST as receiveAlipayNotify } from "../../app/api/payments/alipay/notify/route";
import { POST as createWeChatOrder } from "../../app/api/payments/wechat/create-order/route";
import { POST as receiveWeChatNotify } from "../../app/api/payments/wechat/notify/route";

describe("payment routes", () => {
  it("rejects manual crypto order creation because online payment is disabled", async () => {
    const response = await createCryptoOrder();
    const payload = await response.json();

    expect(response.status).toBe(410);
    expect(payload.message).toContain("激活码");
  });

  it("rejects alipay order creation and notify because online payment is disabled", async () => {
    const createResponse = await createAlipayOrder();
    const createPayload = await createResponse.json();

    expect(createResponse.status).toBe(410);
    expect(createPayload.message).toContain("激活码");

    const notifyResponse = await receiveAlipayNotify();
    const notifyPayload = await notifyResponse.json();

    expect(notifyResponse.status).toBe(410);
    expect(notifyPayload.message).toContain("激活码");
  });

  it("rejects wechat order creation and notify because online payment is disabled", async () => {
    const createResponse = await createWeChatOrder();
    const createPayload = await createResponse.json();

    expect(createResponse.status).toBe(410);
    expect(createPayload.message).toContain("激活码");

    const notifyResponse = await receiveWeChatNotify();
    const notifyPayload = await notifyResponse.json();

    expect(notifyResponse.status).toBe(410);
    expect(notifyPayload.message).toContain("激活码");
  });
});

import crypto from "node:crypto";
import { env } from "@/src/config/env";
import { getRechargePackageById } from "@/src/lib/payments/catalog";
import { completePaidOrder, createPaymentOrder } from "@/src/lib/payments/repository";

type CreateWeChatOrderInput = {
  userId: string;
  packageId: string;
  notifyUrl: string;
};

type WeChatNotifyPayload = {
  out_trade_no: string;
  transaction_id: string;
  trade_state: string;
  notify_signature: string;
};

export function createWeChatOrder({
  userId,
  packageId,
  notifyUrl
}: CreateWeChatOrderInput) {
  const pkg = getRechargePackageById(packageId);

  if (!pkg) {
    throw new Error("Recharge package not found");
  }

  const orderId = `wx_${packageId}_${Date.now()}`;
  createPaymentOrder({
    id: orderId,
    userId,
    provider: "wechat",
    amountUsd: pkg.amountUsd,
    quotaAmount: pkg.quotaAmount,
    kind: "recharge"
  });

  return {
    orderId,
    gatewayUrl: "https://api.mch.weixin.qq.com/v3/pay/transactions/native",
    configReady: Boolean(env.WECHAT_PAY_MERCHANT_ID),
    requestBody: {
      mchid: env.WECHAT_PAY_MERCHANT_ID || "pending_wechat_mchid",
      description: `${pkg.title} ${pkg.quotaAmount}点额度`,
      out_trade_no: orderId,
      notify_url: notifyUrl,
      amount: {
        total: Math.round(pkg.amountUsd * 100),
        currency: "USD"
      }
    },
    note:
      "正式上线时需要接微信支付商户证书、平台证书和 API v3 密钥。现在先把本地订单和调起参数准备好。"
  };
}

export function buildWeChatNotifyPayload({
  orderId,
  transactionId,
  secret,
  tradeState = "SUCCESS"
}: {
  orderId: string;
  transactionId: string;
  secret: string;
  tradeState?: string;
}) {
  const payload: Omit<WeChatNotifyPayload, "notify_signature"> = {
    out_trade_no: orderId,
    transaction_id: transactionId,
    trade_state: tradeState
  };

  return {
    ...payload,
    notify_signature: signWeChatPayload(payload, secret)
  };
}

export function completeWeChatPaymentFromNotify({
  payload,
  secret
}: {
  payload: WeChatNotifyPayload;
  secret: string;
}) {
  if (!secret) {
    throw new Error("WECHAT_PAY_NOTIFY_SECRET is not configured");
  }

  const expectedSignature = payload.notify_signature;
  const actualSignature = signWeChatPayload(
    {
      out_trade_no: payload.out_trade_no,
      transaction_id: payload.transaction_id,
      trade_state: payload.trade_state
    },
    secret
  );

  if (
    !crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "utf8"),
      Buffer.from(actualSignature, "utf8")
    )
  ) {
    throw new Error("WeChat notify signature verification failed");
  }

  if (payload.trade_state !== "SUCCESS") {
    return {
      applied: false
    };
  }

  return completePaidOrder({
    orderId: payload.out_trade_no,
    providerPaymentId: payload.transaction_id
  });
}

function signWeChatPayload(
  payload: Omit<WeChatNotifyPayload, "notify_signature">,
  secret: string
) {
  const normalized = Object.entries(payload)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return crypto.createHmac("sha256", secret).update(normalized, "utf8").digest("hex");
}

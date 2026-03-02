import crypto from "node:crypto";
import { env } from "@/src/config/env";
import { getRechargePackageById } from "@/src/lib/payments/catalog";
import { completePaidOrder, createPaymentOrder } from "@/src/lib/payments/repository";

type CreateAlipayOrderInput = {
  userId: string;
  packageId: string;
  returnUrl: string;
  notifyUrl: string;
};

type ParsedAlipayNotify = {
  out_trade_no: string;
  trade_no: string;
  trade_status: string;
};

export function createAlipayOrder({
  userId,
  packageId,
  returnUrl,
  notifyUrl
}: CreateAlipayOrderInput) {
  const pkg = getRechargePackageById(packageId);

  if (!pkg) {
    throw new Error("Recharge package not found");
  }

  const orderId = `ali_${packageId}_${Date.now()}`;
  createPaymentOrder({
    id: orderId,
    userId,
    provider: "alipay",
    amountUsd: pkg.amountUsd,
    quotaAmount: pkg.quotaAmount,
    kind: "recharge"
  });

  return {
    orderId,
    gatewayUrl: "https://openapi.alipay.com/gateway.do",
    configReady: Boolean(env.ALIPAY_APP_ID),
    formFields: {
      app_id: env.ALIPAY_APP_ID || "pending_alipay_app_id",
      method: "alipay.trade.wap.pay",
      charset: "utf-8",
      sign_type: "RSA2",
      version: "1.0",
      notify_url: notifyUrl,
      return_url: returnUrl,
      biz_content: JSON.stringify({
        out_trade_no: orderId,
        total_amount: pkg.amountUsd.toFixed(2),
        subject: `${pkg.title} ${pkg.quotaAmount}点额度`,
        product_code: "QUICK_WAP_WAY"
      })
    },
    note:
      "正式上线时需要绑定支付宝商家证书并补上 RSA2 签名。现在这一步先把本地订单和前端提交参数准备好。"
  };
}

export function buildAlipayNotifyPayload({
  orderId,
  tradeNo,
  secret,
  tradeStatus = "TRADE_SUCCESS"
}: {
  orderId: string;
  tradeNo: string;
  secret: string;
  tradeStatus?: string;
}) {
  const params = new URLSearchParams({
    out_trade_no: orderId,
    trade_no: tradeNo,
    trade_status: tradeStatus
  });

  params.set("notify_signature", signAlipayParams(params, secret));
  return params.toString();
}

export function completeAlipayPaymentFromNotify({
  payload,
  secret
}: {
  payload: string;
  secret: string;
}) {
  const parsed = parseAlipayNotifyPayload({
    payload,
    secret
  });

  if (!["TRADE_SUCCESS", "TRADE_FINISHED"].includes(parsed.trade_status)) {
    return {
      applied: false
    };
  }

  return completePaidOrder({
    orderId: parsed.out_trade_no,
    providerPaymentId: parsed.trade_no
  });
}

function parseAlipayNotifyPayload({
  payload,
  secret
}: {
  payload: string;
  secret: string;
}): ParsedAlipayNotify {
  if (!secret) {
    throw new Error("ALIPAY_NOTIFY_SECRET is not configured");
  }

  const params = new URLSearchParams(payload);
  const expectedSignature = params.get("notify_signature") ?? "";

  if (!expectedSignature) {
    throw new Error("Alipay notify signature is missing");
  }

  const actualSignature = signAlipayParams(params, secret);

  if (
    !crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "utf8"),
      Buffer.from(actualSignature, "utf8")
    )
  ) {
    throw new Error("Alipay notify signature verification failed");
  }

  return {
    out_trade_no: params.get("out_trade_no") ?? "",
    trade_no: params.get("trade_no") ?? "",
    trade_status: params.get("trade_status") ?? ""
  };
}

function signAlipayParams(params: URLSearchParams, secret: string) {
  const normalized = [...params.entries()]
    .filter(([key]) => key !== "notify_signature")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return crypto.createHmac("sha256", secret).update(normalized, "utf8").digest("hex");
}

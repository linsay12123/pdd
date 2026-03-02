import { env } from "@/src/config/env";
import {
  createPaymentOrder,
  getPaymentOrder
} from "@/src/lib/payments/repository";
import {
  getRechargePackageById,
  type RechargePackage
} from "@/src/lib/payments/catalog";

type CreateStripeCheckoutInput = {
  userId: string;
  packageId: string;
  successUrl: string;
  cancelUrl: string;
  fetchImpl?: typeof fetch;
};

type StripeCheckoutResponse = {
  id: string;
  url: string;
};

export async function createStripeCheckoutSession({
  userId,
  packageId,
  successUrl,
  cancelUrl,
  fetchImpl = fetch
}: CreateStripeCheckoutInput) {
  const pkg = getRechargePackageById(packageId);

  if (!pkg) {
    throw new Error("Recharge package not found");
  }

  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  const orderId = createOrderId(packageId);
  createPaymentOrder({
    id: orderId,
    userId,
    provider: "stripe",
    amountUsd: pkg.amountUsd,
    quotaAmount: pkg.quotaAmount,
    kind: "recharge"
  });

  const formData = buildStripeCheckoutForm({
    orderId,
    pkg,
    successUrl,
    cancelUrl
  });
  const response = await fetchImpl("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: formData
  });

  if (!response.ok) {
    throw new Error(`Stripe checkout creation failed with status ${response.status}`);
  }

  const data = (await response.json()) as StripeCheckoutResponse;

  return {
    orderId,
    sessionId: data.id,
    checkoutUrl: data.url
  };
}

export function buildStripeCheckoutForm({
  orderId,
  pkg,
  successUrl,
  cancelUrl
}: {
  orderId: string;
  pkg: RechargePackage;
  successUrl: string;
  cancelUrl: string;
}) {
  const params = new URLSearchParams();

  params.set("mode", "payment");
  params.set("success_url", successUrl);
  params.set("cancel_url", cancelUrl);
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", "usd");
  params.set(
    "line_items[0][price_data][product_data][name]",
    `${pkg.title} (${pkg.quotaAmount} 点额度)`
  );
  params.set(
    "line_items[0][price_data][product_data][description]",
    pkg.description
  );
  params.set(
    "line_items[0][price_data][unit_amount]",
    String(Math.round(pkg.amountUsd * 100))
  );
  params.set("metadata[order_id]", orderId);
  params.set("metadata[package_id]", pkg.id);

  return params.toString();
}

export function getStripeOrderCheckoutSummary(orderId: string) {
  const order = getPaymentOrder(orderId);

  if (!order) {
    return null;
  }

  return {
    orderId: order.id,
    amountUsd: order.amountUsd,
    quotaAmount: order.quotaAmount
  };
}

function createOrderId(packageId: string) {
  return `ord_${packageId}_${Date.now()}`;
}

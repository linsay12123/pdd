import crypto from "node:crypto";

type StripeWebhookObject = {
  id?: string;
  metadata?: {
    order_id?: string;
    user_id?: string;
    plan_id?: string;
  };
  payment_status?: string;
  subscription?: string;
  status?: string;
  current_period_end?: number;
};

export type StripeWebhookEvent = {
  id: string;
  type: string;
  data: {
    object: StripeWebhookObject;
  };
};

export function buildStripeSignatureHeader({
  payload,
  secret,
  timestamp
}: {
  payload: string;
  secret: string;
  timestamp: number;
}) {
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(signedPayload, "utf8")
    .digest("hex");

  return `t=${timestamp},v1=${signature}`;
}

export function parseStripeWebhookEvent({
  payload,
  signatureHeader,
  secret
}: {
  payload: string;
  signatureHeader: string;
  secret: string;
}): StripeWebhookEvent {
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }

  const fields = Object.fromEntries(
    signatureHeader.split(",").map((item) => {
      const [key, value] = item.split("=");
      return [key, value];
    })
  );
  const timestamp = fields.t;
  const expectedSignature = fields.v1;

  if (!timestamp || !expectedSignature) {
    throw new Error("Stripe signature header is invalid");
  }

  const signedPayload = `${timestamp}.${payload}`;
  const actualSignature = crypto
    .createHmac("sha256", secret)
    .update(signedPayload, "utf8")
    .digest("hex");

  if (
    !crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "utf8"),
      Buffer.from(actualSignature, "utf8")
    )
  ) {
    throw new Error("Stripe signature verification failed");
  }

  return JSON.parse(payload) as StripeWebhookEvent;
}

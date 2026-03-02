import { NextResponse } from "next/server";
import { env } from "@/src/config/env";
import { completePaidOrder } from "@/src/lib/payments/repository";
import { parseStripeWebhookEvent } from "@/src/lib/payments/stripe-signature";
import { syncStripeSubscription } from "@/src/lib/subscriptions/sync-stripe-subscription";

export async function POST(request: Request) {
  const signatureHeader = request.headers.get("stripe-signature") ?? "";
  const payload = await request.text();

  try {
    const event = parseStripeWebhookEvent({
      payload,
      signatureHeader,
      secret: env.STRIPE_WEBHOOK_SECRET
    });

    if (event.type === "checkout.session.completed") {
      const orderId = event.data.object.metadata?.order_id;
      const providerPaymentId = event.data.object.id ?? "";

      if (!orderId) {
        throw new Error("Stripe checkout session is missing order_id metadata");
      }

      const result =
        event.data.object.payment_status === "paid"
          ? completePaidOrder({
              orderId,
              providerPaymentId
            })
          : {
              applied: false
            };

      return NextResponse.json({
        ok: true,
        applied: result.applied
      });
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscriptionId =
        event.data.object.subscription ?? event.data.object.id ?? "";
      const userId = event.data.object.metadata?.user_id ?? "";
      const planId = event.data.object.metadata?.plan_id ?? "";
      const currentPeriodEnd = event.data.object.current_period_end
        ? new Date(event.data.object.current_period_end * 1000).toISOString()
        : "";

      if (!subscriptionId || !userId || !planId || !currentPeriodEnd) {
        throw new Error("Stripe subscription event is missing required metadata");
      }

      const record = syncStripeSubscription({
        userId,
        stripeSubscriptionId: subscriptionId,
        planId,
        status: event.data.object.status ?? "canceled",
        currentPeriodEnd
      });

      return NextResponse.json({
        ok: true,
        subscription: record
      });
    }

    return NextResponse.json({
      ok: true,
      ignored: true
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Stripe webhook 处理失败。"
      },
      { status: 400 }
    );
  }
}

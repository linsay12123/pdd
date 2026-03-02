import { NextResponse } from "next/server";
import { createStripeCheckoutSession } from "@/src/lib/payments/stripe-checkout";

type CreateCheckoutBody = {
  userId?: string;
  packageId?: string;
  successUrl?: string;
  cancelUrl?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CreateCheckoutBody | null;

  if (!body?.userId || !body.packageId || !body.successUrl || !body.cancelUrl) {
    return NextResponse.json(
      {
        ok: false,
        message: "需要用户、套餐、成功回跳地址和取消回跳地址。"
      },
      { status: 400 }
    );
  }

  try {
    const session = await createStripeCheckoutSession({
      userId: body.userId,
      packageId: body.packageId,
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl
    });

    return NextResponse.json({
      ok: true,
      ...session
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Stripe 创建结账链接失败。"
      },
      { status: 500 }
    );
  }
}

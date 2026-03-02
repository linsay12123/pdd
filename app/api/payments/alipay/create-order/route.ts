import { NextResponse } from "next/server";
import { createAlipayOrder } from "@/src/lib/payments/alipay-order";

type CreateAlipayOrderBody = {
  userId?: string;
  packageId?: string;
  returnUrl?: string;
  notifyUrl?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CreateAlipayOrderBody | null;

  if (!body?.userId || !body.packageId || !body.returnUrl || !body.notifyUrl) {
    return NextResponse.json(
      {
        ok: false,
        message: "需要用户、套餐、回跳地址和通知地址。"
      },
      { status: 400 }
    );
  }

  try {
    const order = createAlipayOrder({
      userId: body.userId,
      packageId: body.packageId,
      returnUrl: body.returnUrl,
      notifyUrl: body.notifyUrl
    });

    return NextResponse.json({
      ok: true,
      ...order
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "支付宝订单创建失败。"
      },
      { status: 500 }
    );
  }
}

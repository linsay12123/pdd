import { NextResponse } from "next/server";
import { createWeChatOrder } from "@/src/lib/payments/wechat-order";

type CreateWeChatOrderBody = {
  userId?: string;
  packageId?: string;
  notifyUrl?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CreateWeChatOrderBody | null;

  if (!body?.userId || !body.packageId || !body.notifyUrl) {
    return NextResponse.json(
      {
        ok: false,
        message: "需要用户、套餐和通知地址。"
      },
      { status: 400 }
    );
  }

  try {
    const order = createWeChatOrder({
      userId: body.userId,
      packageId: body.packageId,
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
        message: error instanceof Error ? error.message : "微信支付订单创建失败。"
      },
      { status: 500 }
    );
  }
}

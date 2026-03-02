import { NextResponse } from "next/server";
import { createCoinbaseCharge } from "@/src/lib/payments/coinbase-charge";

type CreateChargeBody = {
  userId?: string;
  packageId?: string;
  successUrl?: string;
  cancelUrl?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CreateChargeBody | null;

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
    const charge = await createCoinbaseCharge({
      userId: body.userId,
      packageId: body.packageId,
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl
    });

    return NextResponse.json({
      ok: true,
      ...charge
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "加密货币支付链接创建失败。"
      },
      { status: 500 }
    );
  }
}

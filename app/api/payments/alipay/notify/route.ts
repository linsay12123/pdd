import { NextResponse } from "next/server";
import { env } from "@/src/config/env";
import { completeAlipayPaymentFromNotify } from "@/src/lib/payments/alipay-order";

export async function POST(request: Request) {
  const payload = await request.text();

  try {
    const result = completeAlipayPaymentFromNotify({
      payload,
      secret: env.ALIPAY_NOTIFY_SECRET
    });

    return NextResponse.json({
      ok: true,
      applied: result.applied ?? false
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "支付宝通知处理失败。"
      },
      { status: 400 }
    );
  }
}

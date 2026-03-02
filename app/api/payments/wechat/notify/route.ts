import { NextResponse } from "next/server";
import { env } from "@/src/config/env";
import { completeWeChatPaymentFromNotify } from "@/src/lib/payments/wechat-order";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as
    | {
        out_trade_no?: string;
        transaction_id?: string;
        trade_state?: string;
        notify_signature?: string;
      }
    | null;

  if (
    !payload?.out_trade_no ||
    !payload.transaction_id ||
    !payload.trade_state ||
    !payload.notify_signature
  ) {
    return NextResponse.json(
      {
        ok: false,
        message: "微信通知内容不完整。"
      },
      { status: 400 }
    );
  }

  try {
    const result = completeWeChatPaymentFromNotify({
      payload: {
        out_trade_no: payload.out_trade_no,
        transaction_id: payload.transaction_id,
        trade_state: payload.trade_state,
        notify_signature: payload.notify_signature
      },
      secret: env.WECHAT_PAY_NOTIFY_SECRET
    });

    return NextResponse.json({
      ok: true,
      applied: result.applied ?? false
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "微信通知处理失败。"
      },
      { status: 400 }
    );
  }
}

import { NextResponse } from "next/server";
import { completeCoinbaseChargeFromEvent } from "@/src/lib/payments/coinbase-charge";

export async function POST(request: Request) {
  try {
    const event = (await request.json()) as {
      type: string;
      data: {
        id?: string;
        metadata?: {
          order_id?: string;
        };
      };
    };

    const result = completeCoinbaseChargeFromEvent({
      event
    });

    return NextResponse.json({
      ok: true,
      applied: result.applied ?? false
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Coinbase webhook 处理失败。"
      },
      { status: 400 }
    );
  }
}

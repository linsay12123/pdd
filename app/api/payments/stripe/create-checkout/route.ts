import { NextResponse } from "next/server";

export async function POST(request: Request) {
  await request.text().catch(() => "");

  return NextResponse.json(
    {
      ok: false,
      message: "Stripe 收款入口已关闭，请改用 USDC、支付宝或微信支付。"
    },
    { status: 410 }
  );
}

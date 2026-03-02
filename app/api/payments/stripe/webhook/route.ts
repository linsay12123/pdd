import { NextResponse } from "next/server";

export async function POST(request: Request) {
  await request.text().catch(() => "");

  return NextResponse.json(
    {
      ok: false,
      message: "Stripe Webhook 已关闭，因为当前产品不再使用 Stripe 收款。"
    },
    { status: 410 }
  );
}

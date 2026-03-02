import { NextResponse } from "next/server";

export async function POST(request: Request) {
  await request.text().catch(() => "");

  return NextResponse.json(
    {
      ok: false,
      message: "在线支付入口已关闭，请改用额度激活码充值。"
    },
    { status: 410 }
  );
}

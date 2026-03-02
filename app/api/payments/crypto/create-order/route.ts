import { NextResponse } from "next/server";
import { createManualCryptoOrder } from "@/src/lib/payments/manual-crypto";

type CreateCryptoOrderBody = {
  userId?: string;
  packageId?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CreateCryptoOrderBody | null;

  if (!body?.userId || !body.packageId) {
    return NextResponse.json(
      {
        ok: false,
        message: "需要用户和套餐，才能生成稳定币付款说明。"
      },
      { status: 400 }
    );
  }

  try {
    const order = createManualCryptoOrder({
      userId: body.userId,
      packageId: body.packageId
    });

    return NextResponse.json({
      ok: true,
      ...order
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "稳定币付款说明生成失败。"
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { redeemActivationCode } from "@/src/lib/activation-codes/redeem-activation-code";
import { redeemActivationCodeInSupabase } from "@/src/lib/activation-codes/supabase-repository";
import {
  isUuidLike,
  shouldUseSupabasePersistence
} from "@/src/lib/persistence/runtime-mode";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);

  if (
    !payload ||
    typeof payload.userId !== "string" ||
    typeof payload.code !== "string" ||
    !payload.userId.trim() ||
    !payload.code.trim()
  ) {
    return NextResponse.json(
      {
        message: "需要用户和激活码，才能兑换积分。"
      },
      { status: 400 }
    );
  }

  try {
    const userId = payload.userId.trim();
    const code = payload.code.trim();
    const useSupabase = shouldUseSupabasePersistence();

    if (useSupabase && !isUuidLike(userId)) {
      return NextResponse.json(
        {
          ok: false,
          message: "用户标识格式不正确，请重新登录后重试。"
        },
        { status: 400 }
      );
    }

    if (useSupabase) {
      const result = await redeemActivationCodeInSupabase({
        userId,
        code
      });

      return NextResponse.json({
        ok: true,
        code: result.code,
        creditedQuota: result.quotaAmount,
        currentQuota: result.currentQuota
      });
    }

    const result = redeemActivationCode({
      userId,
      code
    });

    return NextResponse.json({
      ok: true,
      code: result.redemption.code,
      creditedQuota: result.redemption.quotaAmount,
      currentQuota: result.wallet.rechargeQuota
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "激活码兑换失败"
      },
      { status: 400 }
    );
  }
}

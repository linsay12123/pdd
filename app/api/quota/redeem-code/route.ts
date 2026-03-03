import { NextResponse } from "next/server";
import { requireCurrentSessionUser } from "@/src/lib/auth/current-user";
import { redeemActivationCode } from "@/src/lib/activation-codes/redeem-activation-code";
import { redeemActivationCodeInSupabase } from "@/src/lib/activation-codes/supabase-repository";
import type { SessionUser } from "@/src/types/auth";
import {
  isUuidLike,
  shouldUseSupabasePersistence
} from "@/src/lib/persistence/runtime-mode";

type RedeemCodeRouteDependencies = {
  requireUser?: () => Promise<SessionUser>;
  shouldUseSupabase?: () => boolean;
  redeemInSupabase?: typeof redeemActivationCodeInSupabase;
  redeemLocally?: typeof redeemActivationCode;
};

export async function handleRedeemCodeRequest(
  request: Request,
  dependencies: RedeemCodeRouteDependencies = {}
) {
  const payload = await request.json().catch(() => null);

  if (
    !payload ||
    typeof payload.code !== "string" ||
    !payload.code.trim()
  ) {
    return NextResponse.json(
      {
        message: "需要激活码，才能兑换积分。"
      },
      { status: 400 }
    );
  }

  try {
    const user = await (dependencies.requireUser ?? requireCurrentSessionUser)();
    const code = payload.code.trim();
    const useSupabase = (dependencies.shouldUseSupabase ?? shouldUseSupabasePersistence)();
    const redeemViaSupabase = dependencies.redeemInSupabase ?? redeemActivationCodeInSupabase;
    const redeemViaLocal = dependencies.redeemLocally ?? redeemActivationCode;

    if (useSupabase && !isUuidLike(user.id)) {
      return NextResponse.json(
        {
          ok: false,
          message: "用户标识格式不正确，请重新登录后重试。"
        },
        { status: 400 }
      );
    }

    if (useSupabase) {
      const result = await redeemViaSupabase({
        userId: user.id,
        code
      });

      return NextResponse.json({
        ok: true,
        code: result.code,
        creditedQuota: result.quotaAmount,
        currentQuota: result.currentQuota
      });
    }

    const result = redeemViaLocal({
      userId: user.id,
      code
    });

    return NextResponse.json({
      ok: true,
      code: result.redemption.code,
      creditedQuota: result.redemption.quotaAmount,
      currentQuota: result.wallet.rechargeQuota
    });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json(
        {
          ok: false,
          message: "请先登录后再兑换激活码。"
        },
        { status: 401 }
      );
    }

    if (error instanceof Error && error.message === "ACCOUNT_FROZEN") {
      return NextResponse.json(
        {
          ok: false,
          message: "当前账号已被冻结，请联系客服支持团队处理。"
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "激活码兑换失败"
      },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  return handleRedeemCodeRequest(request);
}

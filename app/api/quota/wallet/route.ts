import { NextResponse } from "next/server";
import { resolveRequestUserId } from "@/src/lib/auth/request-user";
import { getUserWallet } from "@/src/lib/payments/repository";
import { getUserWalletFromSupabase } from "@/src/lib/payments/supabase-wallet";
import {
  isUuidLike,
  shouldUseSupabasePersistence
} from "@/src/lib/persistence/runtime-mode";

export async function GET(request: Request) {
  const userId = resolveRequestUserId(request);

  if (!userId) {
    return NextResponse.json(
      {
        ok: false,
        message: "请先登录后再查看当前积分。"
      },
      { status: 401 }
    );
  }

  try {
    const useSupabase = shouldUseSupabasePersistence();
    const wallet =
      useSupabase && isUuidLike(userId)
        ? await getUserWalletFromSupabase(userId)
        : getUserWallet(userId);

    return NextResponse.json({
      ok: true,
      userId,
      wallet: {
        rechargeQuota: wallet.rechargeQuota,
        frozenQuota: wallet.frozenQuota
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "读取积分失败"
      },
      { status: 500 }
    );
  }
}

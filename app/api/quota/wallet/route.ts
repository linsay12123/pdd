import { NextResponse } from "next/server";
import { requireCurrentSessionUser } from "@/src/lib/auth/current-user";
import { getUserWallet } from "@/src/lib/payments/repository";
import { getUserWalletFromSupabase } from "@/src/lib/payments/supabase-wallet";
import type { SessionUser } from "@/src/types/auth";
import type { WalletSnapshot } from "@/src/types/billing";
import {
  isUuidLike,
  shouldUseSupabasePersistence
} from "@/src/lib/persistence/runtime-mode";

type QuotaWalletRouteDependencies = {
  requireUser?: () => Promise<SessionUser>;
  shouldUseSupabase?: () => boolean;
  getSupabaseWallet?: (userId: string) => Promise<WalletSnapshot>;
  getLocalWallet?: (userId: string) => WalletSnapshot;
};

export async function handleQuotaWalletRequest(
  _request: Request,
  dependencies: QuotaWalletRouteDependencies = {}
) {
  try {
    const user = await (dependencies.requireUser ?? requireCurrentSessionUser)();
    const useSupabase = (dependencies.shouldUseSupabase ?? shouldUseSupabasePersistence)();
    const loadSupabaseWallet = dependencies.getSupabaseWallet ?? getUserWalletFromSupabase;
    const loadLocalWallet = dependencies.getLocalWallet ?? getUserWallet;

    const wallet =
      useSupabase && isUuidLike(user.id)
        ? await loadSupabaseWallet(user.id)
        : loadLocalWallet(user.id);

    return NextResponse.json({
      ok: true,
      userId: user.id,
      wallet: {
        rechargeQuota: wallet.rechargeQuota,
        frozenQuota: wallet.frozenQuota
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json(
        {
          ok: false,
          message: "请先登录后再查看当前积分。"
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
        message: error instanceof Error ? error.message : "读取积分失败"
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return handleQuotaWalletRequest(request);
}

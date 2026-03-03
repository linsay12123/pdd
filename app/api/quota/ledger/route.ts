import { NextResponse } from "next/server";
import { requireCurrentSessionUser } from "@/src/lib/auth/current-user";
import { getPaymentLedgerHistory, getUserLedgerHistoryFromSupabase } from "@/src/lib/payments/ledger-history";
import type { SessionUser } from "@/src/types/auth";
import {
  isUuidLike,
  shouldUseSupabasePersistence
} from "@/src/lib/persistence/runtime-mode";

type QuotaLedgerRouteDependencies = {
  requireUser?: () => Promise<SessionUser>;
  shouldUseSupabase?: () => boolean;
  getSupabaseLedger?: (userId: string, limit?: number) => Promise<ReturnType<typeof getPaymentLedgerHistory>>;
  getLocalLedger?: (userId: string, limit?: number) => ReturnType<typeof getPaymentLedgerHistory>;
};

export async function handleQuotaLedgerRequest(
  _request: Request,
  dependencies: QuotaLedgerRouteDependencies = {}
) {
  try {
    const user = await (dependencies.requireUser ?? requireCurrentSessionUser)();
    const useSupabase = (dependencies.shouldUseSupabase ?? shouldUseSupabasePersistence)();
    const loadSupabaseLedger =
      dependencies.getSupabaseLedger ?? getUserLedgerHistoryFromSupabase;
    const loadLocalLedger = dependencies.getLocalLedger ?? getPaymentLedgerHistory;

    const entries =
      useSupabase && isUuidLike(user.id)
        ? await loadSupabaseLedger(user.id, 8)
        : loadLocalLedger(user.id, 8);

    return NextResponse.json({
      ok: true,
      entries
    });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json(
        {
          ok: false,
          message: "请先登录后再查看积分记录。"
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
        message: error instanceof Error ? error.message : "读取积分记录失败"
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return handleQuotaLedgerRequest(request);
}

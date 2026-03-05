import { releaseQuota } from "@/src/lib/billing/release-quota";
import {
  applyWalletMutationWithLedgerInSupabase,
  getUserWalletFromSupabase
} from "@/src/lib/payments/supabase-wallet";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import type { FrozenQuotaReservation } from "@/src/types/billing";

const generationProcessingStatuses = [
  "drafting",
  "adjusting_word_count",
  "verifying_references",
  "exporting"
] as const;

const humanizeProcessingStatuses = ["queued", "processing", "retrying"] as const;

const defaultGenerationTimeoutSeconds = 30 * 60;
const defaultHumanizeTimeoutSeconds = 30 * 60;
const defaultBatchSize = 200;

type CleanupInput = {
  now?: Date;
  generationTimeoutSeconds?: number;
  humanizeTimeoutSeconds?: number;
  batchSize?: number;
};

type CleanupTaskRow = {
  id: string;
  user_id: string;
  status: string;
  quota_reservation: unknown;
  updated_at: string | null;
  humanize_status: string | null;
  humanize_requested_at: string | null;
};

type CleanupDetail = {
  taskId: string;
  userId: string;
  chargePath: "generation" | "humanize" | "unknown";
  action: "released" | "skipped" | "failed";
  reason: string;
};

export type CleanupStaleReservationsResult = {
  scanned: number;
  released: number;
  skipped: number;
  failed: number;
  details: CleanupDetail[];
};

export async function cleanupStaleQuotaReservations(
  input: CleanupInput = {}
): Promise<CleanupStaleReservationsResult> {
  const now = input.now ?? new Date();
  const generationTimeoutSeconds =
    input.generationTimeoutSeconds ?? defaultGenerationTimeoutSeconds;
  const humanizeTimeoutSeconds =
    input.humanizeTimeoutSeconds ?? defaultHumanizeTimeoutSeconds;
  const batchSize = input.batchSize ?? defaultBatchSize;

  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("writing_tasks")
    .select(
      "id,user_id,status,quota_reservation,updated_at,humanize_status,humanize_requested_at"
    )
    .not("quota_reservation", "is", null)
    .limit(batchSize);

  if (error) {
    throw new Error(`扫描冻结积分失败：${error.message}`);
  }

  const rows = (data ?? []) as CleanupTaskRow[];
  const result: CleanupStaleReservationsResult = {
    scanned: rows.length,
    released: 0,
    skipped: 0,
    failed: 0,
    details: []
  };

  for (const row of rows) {
    const reservation = parseReservation(row.quota_reservation);
    if (!reservation) {
      result.skipped += 1;
      result.details.push({
        taskId: row.id,
        userId: row.user_id,
        chargePath: "unknown",
        action: "skipped",
        reason: "quota_reservation 格式无效"
      });
      continue;
    }

    const stale = resolveStaleReason({
      row,
      reservation,
      now,
      generationTimeoutSeconds,
      humanizeTimeoutSeconds
    });

    if (!stale.isStale) {
      result.skipped += 1;
      result.details.push({
        taskId: row.id,
        userId: row.user_id,
        chargePath: reservation.chargePath,
        action: "skipped",
        reason: stale.reason
      });
      continue;
    }

    try {
      await releaseReservation({
        taskId: row.id,
        userId: row.user_id,
        reservation
      });
      await markTaskAfterRelease({
        taskId: row.id,
        userId: row.user_id,
        reservation,
        now
      });

      result.released += 1;
      result.details.push({
        taskId: row.id,
        userId: row.user_id,
        chargePath: reservation.chargePath,
        action: "released",
        reason: stale.reason
      });
    } catch (releaseError) {
      result.failed += 1;
      result.details.push({
        taskId: row.id,
        userId: row.user_id,
        chargePath: reservation.chargePath,
        action: "failed",
        reason: releaseError instanceof Error ? releaseError.message : String(releaseError)
      });
    }
  }

  return result;
}

function parseReservation(raw: unknown): FrozenQuotaReservation | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const maybe = raw as Record<string, unknown>;
  const chargePath = maybe.chargePath;

  if (chargePath !== "generation" && chargePath !== "humanize") {
    return null;
  }

  const reservationId = String(maybe.reservationId ?? "").trim();
  const taskId = String(maybe.taskId ?? "").trim();
  const totalAmount = Number(maybe.totalAmount);
  const fromSubscription = Number(maybe.fromSubscription);
  const fromRecharge = Number(maybe.fromRecharge);

  if (
    !reservationId ||
    !taskId ||
    !Number.isFinite(totalAmount) ||
    !Number.isFinite(fromSubscription) ||
    !Number.isFinite(fromRecharge)
  ) {
    return null;
  }

  return {
    reservationId,
    taskId,
    chargePath,
    totalAmount,
    fromSubscription,
    fromRecharge
  };
}

function resolveStaleReason(input: {
  row: CleanupTaskRow;
  reservation: FrozenQuotaReservation;
  now: Date;
  generationTimeoutSeconds: number;
  humanizeTimeoutSeconds: number;
}) {
  const updatedAtMs = Date.parse(input.row.updated_at ?? "");
  const humanizeRequestedAtMs = Date.parse(input.row.humanize_requested_at ?? "");
  const nowMs = input.now.getTime();

  if (input.reservation.chargePath === "generation") {
    if (!generationProcessingStatuses.includes(input.row.status as never)) {
      return {
        isStale: false,
        reason: `任务状态 ${input.row.status} 不属于正文处理中`
      };
    }

    if (!Number.isFinite(updatedAtMs)) {
      return {
        isStale: true,
        reason: "正文任务缺少更新时间，按超时处理"
      };
    }

    const elapsedSeconds = Math.floor((nowMs - updatedAtMs) / 1000);
    if (elapsedSeconds < input.generationTimeoutSeconds) {
      return {
        isStale: false,
        reason: `正文任务仍在等待窗口内（${elapsedSeconds}s）`
      };
    }

    return {
      isStale: true,
      reason: `正文任务超时（${elapsedSeconds}s）`
    };
  }

  if (!humanizeProcessingStatuses.includes((input.row.humanize_status ?? "") as never)) {
    return {
      isStale: false,
      reason: `降AI状态 ${input.row.humanize_status ?? "idle"} 不属于处理中`
    };
  }

  const baselineMs = Number.isFinite(humanizeRequestedAtMs) ? humanizeRequestedAtMs : updatedAtMs;
  if (!Number.isFinite(baselineMs)) {
    return {
      isStale: true,
      reason: "降AI任务缺少开始时间，按超时处理"
    };
  }

  const elapsedSeconds = Math.floor((nowMs - baselineMs) / 1000);
  if (elapsedSeconds < input.humanizeTimeoutSeconds) {
    return {
      isStale: false,
      reason: `降AI任务仍在等待窗口内（${elapsedSeconds}s）`
    };
  }

  return {
    isStale: true,
    reason: `降AI任务超时（${elapsedSeconds}s）`
  };
}

async function releaseReservation(input: {
  taskId: string;
  userId: string;
  reservation: FrozenQuotaReservation;
}) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const wallet = await getUserWalletFromSupabase(input.userId);
    const released = releaseQuota({
      wallet,
      reservation: input.reservation
    });

    try {
      await applyWalletMutationWithLedgerInSupabase({
        userId: input.userId,
        taskId: input.taskId,
        expectedWallet: wallet,
        nextWallet: released.wallet,
        entry: released.entry
      });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes("quota_ledger_entries_unique_event_key_key")) {
        return;
      }

      if (message === "WALLET_CONFLICT" || message === "WALLET_NEGATIVE_NOT_ALLOWED") {
        lastError = error;
        continue;
      }

      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("RELEASE_WALLET_CONFLICT");
}

async function markTaskAfterRelease(input: {
  taskId: string;
  userId: string;
  reservation: FrozenQuotaReservation;
  now: Date;
}) {
  const client = createSupabaseAdminClient();

  if (input.reservation.chargePath === "generation") {
    const { error } = await client
      .from("writing_tasks")
      .update({
        quota_reservation: null,
        status: "failed"
      })
      .eq("id", input.taskId)
      .eq("user_id", input.userId)
      .in("status", [...generationProcessingStatuses]);

    if (error) {
      throw new Error(`写回正文任务失败状态失败：${error.message}`);
    }

    return;
  }

  const { error } = await client
    .from("writing_tasks")
    .update({
      quota_reservation: null,
      humanize_status: "failed",
      humanize_error_message: "降AI任务超时，系统已自动释放冻结积分。",
      humanize_completed_at: input.now.toISOString()
    })
    .eq("id", input.taskId)
    .eq("user_id", input.userId)
    .in("humanize_status", [...humanizeProcessingStatuses]);

  if (error) {
    throw new Error(`写回降AI失败状态失败：${error.message}`);
  }
}

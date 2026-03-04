import { exportDocx } from "@/src/lib/deliverables/export-docx";
import {
  draftToDocxContent,
  humanizeDraft as humanizeDraftText
} from "@/src/lib/humanize/stealthgpt-client";
import type { HumanizeProvider } from "@/src/lib/humanize/humanize-provider";
import { resolveHumanizeProvider } from "@/src/lib/humanize/resolve-provider";
import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import {
  appendPaymentLedgerEntryToSupabase,
  getUserWalletFromSupabase,
  setUserWalletInSupabase
} from "@/src/lib/payments/supabase-wallet";
import { releaseQuota } from "@/src/lib/billing/release-quota";
import { settleQuota } from "@/src/lib/billing/settle-quota";
import { setOwnedTaskStatusInSupabase } from "@/src/lib/tasks/supabase-task-records";
import type { FrozenQuotaReservation } from "@/src/types/billing";

export type HumanizeDraftJobInput = {
  taskId: string;
  draftMarkdown: string;
  userId: string;
  reservationSnapshot: FrozenQuotaReservation;
  citationStyle: string;
};

export async function queueHumanizeDraft(input: HumanizeDraftJobInput) {
  return {
    job: "humanizeDraft",
    queued: false,
    input
  };
}

export async function humanizeDraft(
  input: HumanizeDraftJobInput,
  overrideProvider?: HumanizeProvider
) {
  if (!shouldUseSupabasePersistence()) {
    throw new Error("REAL_PERSISTENCE_REQUIRED");
  }

  await setOwnedTaskStatusInSupabase(input.taskId, input.userId, "humanizing");

  try {
    const provider = resolveHumanizeProvider(overrideProvider);
    const humanizedDraft = await humanizeDraftText(input.draftMarkdown, provider);
    const docxContent = draftToDocxContent(humanizedDraft);
    const exportResult = await exportDocx({
      taskId: input.taskId,
      userId: input.userId,
      title: docxContent.title,
      sections: docxContent.sections,
      references:
        docxContent.references.length > 0
          ? docxContent.references
          : ["References preserved in the source draft."],
      citationStyle: input.citationStyle,
      variant: "humanized",
      outputKind: "humanized_docx"
    });

    const wallet = await getUserWalletFromSupabase(input.userId);
    const settled = settleQuota({
      wallet,
      reservation: input.reservationSnapshot
    });
    await setUserWalletInSupabase(input.userId, settled.wallet);
    await appendPaymentLedgerEntryToSupabase({
      userId: input.userId,
      taskId: input.taskId,
      entry: settled.entry,
      walletAfter: settled.wallet
    });
    await setOwnedTaskStatusInSupabase(input.taskId, input.userId, "humanized_ready");

    return {
      taskId: input.taskId,
      humanizedDraft,
      outputId: exportResult.outputId,
      outputPath: exportResult.outputPath
    };
  } catch (error) {
    try {
      const wallet = await getUserWalletFromSupabase(input.userId);
      const released = releaseQuota({
        wallet,
        reservation: input.reservationSnapshot
      });
      await setUserWalletInSupabase(input.userId, released.wallet);
      await appendPaymentLedgerEntryToSupabase({
        userId: input.userId,
        taskId: input.taskId,
        entry: released.entry,
        walletAfter: released.wallet
      });
    } catch (releaseError) {
      console.error(
        "[humanize-draft] refund failed:",
        releaseError instanceof Error ? releaseError.message : releaseError
      );
    }

    try {
      await setOwnedTaskStatusInSupabase(input.taskId, input.userId, "failed");
    } catch (statusError) {
      console.error(
        "[humanize-draft] failed to update task status:",
        statusError instanceof Error ? statusError.message : statusError
      );
    }

    throw error;
  }
}

import { exportDocx } from "@/src/lib/deliverables/export-docx";
import {
  draftToDocxContent,
  humanizeDraft as humanizeDraftText
} from "@/src/lib/humanize/stealthgpt-client";
import { resolveHumanizeProvider } from "@/src/lib/humanize/resolve-provider";
import { settleQuota } from "@/src/lib/billing/settle-quota";
import { releaseQuota } from "@/src/lib/billing/release-quota";
import {
  appendPaymentLedgerEntry,
  getUserWallet,
  setUserWallet
} from "@/src/lib/payments/repository";
import { getTaskSummary, updateTaskStatus } from "@/src/lib/tasks/repository";
import type { FrozenQuotaReservation } from "@/src/types/billing";
import type { HumanizeProvider } from "@/src/lib/humanize/humanize-provider";

export type HumanizeDraftJobInput = {
  taskId: string;
  draftMarkdown: string;
  userId: string;
  reservationSnapshot: FrozenQuotaReservation;
};

export async function queueHumanizeDraft(input: HumanizeDraftJobInput) {
  return {
    job: "humanizeDraft",
    queued: true,
    input
  };
}

export async function humanizeDraft(
  input: HumanizeDraftJobInput,
  overrideProvider?: HumanizeProvider
) {
  const task = getTaskSummary(input.taskId);

  if (task) {
    updateTaskStatus(input.taskId, "humanizing");
  }

  try {
    if (!task?.citationStyle) {
      throw new Error("TASK_CITATION_STYLE_NOT_READY");
    }

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
      citationStyle: task.citationStyle,
      variant: "humanized",
      outputKind: "humanized_docx"
    });

    const wallet = getUserWallet(input.userId);
    const settled = settleQuota({ wallet, reservation: input.reservationSnapshot });
    setUserWallet(input.userId, settled.wallet);
    appendPaymentLedgerEntry(input.userId, settled.entry);

    if (task) {
      updateTaskStatus(input.taskId, "humanized_ready");
    }

    return {
      taskId: input.taskId,
      humanizedDraft,
      outputPath: exportResult.outputPath
    };
  } catch (error) {
    const wallet = getUserWallet(input.userId);
    const released = releaseQuota({ wallet, reservation: input.reservationSnapshot });
    setUserWallet(input.userId, released.wallet);
    appendPaymentLedgerEntry(input.userId, released.entry);

    if (task) {
      updateTaskStatus(input.taskId, "failed");
    }

    throw error;
  }
}

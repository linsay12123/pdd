import { task, wait } from "@trigger.dev/sdk/v3";
import { exportDocx } from "@/src/lib/deliverables/export-docx";
import {
  buildHumanizeSubmission,
  draftToDocxContent,
  rebuildDraftWithHumanizedBody,
  validateHumanizedBody
} from "@/src/lib/humanize/humanize-markdown";
import type { HumanizeProvider } from "@/src/lib/humanize/humanize-provider";
import {
  defaultHumanizeProfile,
} from "@/src/lib/humanize/humanize-provider";
import { resolveHumanizeProvider } from "@/src/lib/humanize/resolve-provider";
import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import {
  applyWalletMutationWithLedgerInSupabase,
  getUserWalletFromSupabase,
} from "@/src/lib/payments/supabase-wallet";
import { releaseQuota } from "@/src/lib/billing/release-quota";
import { settleQuota } from "@/src/lib/billing/settle-quota";
import {
  setOwnedTaskQuotaReservationInSupabase,
  updateOwnedTaskHumanizeStateInSupabase
} from "@/src/lib/tasks/supabase-task-records";
import type { FrozenQuotaReservation } from "@/src/types/billing";

export type HumanizeDraftJobInput = {
  taskId: string;
  draftMarkdown: string;
  userId: string;
  reservationSnapshot: FrozenQuotaReservation;
  citationStyle: string;
};

type HumanizeDraftDependencies = {
  provider?: HumanizeProvider;
  waitFor?: (seconds: number) => Promise<void>;
};

const humanizePollIntervalSeconds = 20;
const humanizePollLimit = 24;

export const humanizeDraftTask = task({
  id: "humanize-draft",
  retry: {
    maxAttempts: 1
  },
  maxDuration: 1800,
  run: async (payload: HumanizeDraftJobInput) => {
    return runHumanizeDraftPipeline(payload);
  }
});

export async function runHumanizeDraftPipeline(
  input: HumanizeDraftJobInput,
  dependencies: HumanizeDraftDependencies = {}
) {
  if (!shouldUseSupabasePersistence()) {
    throw new Error("REAL_PERSISTENCE_REQUIRED");
  }

  const provider = dependencies.provider ?? resolveHumanizeProvider();
  const pause = dependencies.waitFor ?? (async (seconds: number) => wait.for({ seconds }));
  const submission = buildHumanizeSubmission(input.draftMarkdown);

  try {
    await updateOwnedTaskHumanizeStateInSupabase(input.taskId, input.userId, {
      status: "processing",
      provider: provider.name,
      profileSnapshot: defaultHumanizeProfile,
      errorMessage: null
    });

    const firstRun = await provider.submitDocument({
      content: submission.bodyForHumanize,
      profile: defaultHumanizeProfile
    });

    await updateOwnedTaskHumanizeStateInSupabase(input.taskId, input.userId, {
      status: "processing",
      documentId: firstRun.documentId,
      errorMessage: null
    });

    const firstBody = await waitForHumanizedBody({
      provider,
      documentId: firstRun.documentId,
      pause
    });

    let finalBody = firstBody;
    let retryDocumentId: string | null = null;
    let validation = validateHumanizedBody({
      originalBody: submission.bodyForHumanize,
      humanizedBody: firstBody
    });

    if (!validation.ok) {
      await updateOwnedTaskHumanizeStateInSupabase(input.taskId, input.userId, {
        status: "retrying",
        errorMessage: `第一次降AI结果不可用：${validation.reason}`
      });

      const retryRun = await provider.rehumanize(firstRun.documentId);
      retryDocumentId = retryRun.documentId;

      await updateOwnedTaskHumanizeStateInSupabase(input.taskId, input.userId, {
        status: "retrying",
        retryDocumentId
      });

      finalBody = await waitForHumanizedBody({
        provider,
        documentId: retryDocumentId,
        pause
      });

      validation = validateHumanizedBody({
        originalBody: submission.bodyForHumanize,
        humanizedBody: finalBody
      });

      if (!validation.ok) {
        throw new Error(`HUMANIZE_RESULT_INVALID:${validation.reason}`);
      }
    }

    const humanizedDraft = rebuildDraftWithHumanizedBody({
      original: submission,
      humanizedBody: finalBody
    });
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

    await settleHumanizeQuotaAtomically(input);
    await setOwnedTaskQuotaReservationInSupabase(input.taskId, input.userId, null);

    await updateOwnedTaskHumanizeStateInSupabase(input.taskId, input.userId, {
      status: "completed",
      retryDocumentId,
      errorMessage: null,
      completedAt: new Date().toISOString()
    });

    return {
      taskId: input.taskId,
      humanizedDraft,
      outputId: exportResult.outputId,
      outputPath: exportResult.outputPath
    };
  } catch (error) {
    let released = false;
    try {
      await releaseHumanizeQuotaAtomically(input);
      released = true;
    } catch (releaseError) {
      console.error(
        "[humanize-draft] refund failed:",
        releaseError instanceof Error ? releaseError.message : releaseError
      );
    }

    try {
      await updateOwnedTaskHumanizeStateInSupabase(input.taskId, input.userId, {
        status: "failed",
        errorMessage: humanizeFailureMessage(error)
      });
    } catch (statusError) {
      console.error(
        "[humanize-draft] failed to update humanize state:",
        statusError instanceof Error ? statusError.message : statusError
      );
    }

    if (released) {
      try {
        await setOwnedTaskQuotaReservationInSupabase(input.taskId, input.userId, null);
      } catch (cleanupError) {
        console.error(
          "[humanize-draft] failed to clear quota reservation:",
          cleanupError instanceof Error ? cleanupError.message : cleanupError
        );
      }
    }

    throw error;
  }
}

async function settleHumanizeQuotaAtomically(input: HumanizeDraftJobInput) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const wallet = await getUserWalletFromSupabase(input.userId);
    const settled = settleQuota({
      wallet,
      reservation: input.reservationSnapshot
    });
    try {
      await applyWalletMutationWithLedgerInSupabase({
        userId: input.userId,
        taskId: input.taskId,
        expectedWallet: wallet,
        nextWallet: settled.wallet,
        entry: settled.entry
      });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === "WALLET_CONFLICT" || message === "WALLET_NEGATIVE_NOT_ALLOWED") {
        continue;
      }
      throw error;
    }
  }

  throw new Error("SETTLE_WALLET_CONFLICT");
}

async function releaseHumanizeQuotaAtomically(input: HumanizeDraftJobInput) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const wallet = await getUserWalletFromSupabase(input.userId);
    const released = releaseQuota({
      wallet,
      reservation: input.reservationSnapshot
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
      if (message === "WALLET_CONFLICT" || message === "WALLET_NEGATIVE_NOT_ALLOWED") {
        continue;
      }
      throw error;
    }
  }

  throw new Error("RELEASE_WALLET_CONFLICT");
}

async function waitForHumanizedBody(input: {
  provider: HumanizeProvider;
  documentId: string;
  pause: (seconds: number) => Promise<void>;
}) {
  for (let attempt = 1; attempt <= humanizePollLimit; attempt += 1) {
    const result = await input.provider.getDocument(input.documentId);

    if (result.output?.trim()) {
      return result.output.trim();
    }

    if (attempt === humanizePollLimit) {
      break;
    }

    await input.pause(humanizePollIntervalSeconds);
  }

  throw new Error("HUMANIZE_TIMEOUT");
}

function humanizeFailureMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "HUMANIZE_TIMEOUT") {
      return "降AI处理超时，请稍后重试。";
    }

    if (error.message.startsWith("HUMANIZE_RESULT_INVALID:")) {
      return "降AI返回的结果不完整，系统已经自动重试过一次，请稍后重试。";
    }

    return error.message;
  }

  return "降AI处理失败，请稍后再试。";
}

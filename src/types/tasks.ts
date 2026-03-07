export type TaskStatus =
  | "created"
  | "awaiting_primary_file_confirmation"
  | "awaiting_outline_approval"
  | "drafting"
  | "adjusting_word_count"
  | "verifying_references"
  | "exporting"
  | "deliverable_ready"
  | "failed"
  | "expired";

export type TaskHumanizeStatus =
  | "idle"
  | "queued"
  | "processing"
  | "retrying"
  | "completed"
  | "failed";

export type TaskProviderErrorKind = "http_error" | "transport_error" | "timeout";

export type TaskAnalysisRenderMode =
  | "structured"
  | "raw_model"
  | "raw_provider_error"
  | "system_error";

export type TaskAnalysisSnapshot = {
  chosenTaskFileId: string | null;
  supportingFileIds: string[];
  ignoredFileIds: string[];
  needsUserConfirmation: boolean;
  reasoning: string;
  targetWordCount: number;
  citationStyle: string;
  topic: string | null;
  chapterCount: number | null;
  mustCover: string[];
  gradingFocus: string[];
  appliedSpecialRequirements: string;
  usedDefaultWordCount: boolean;
  usedDefaultCitationStyle: boolean;
  warnings: string[];
  analysisRenderMode?: TaskAnalysisRenderMode | null;
  rawModelResponse?: string | null;
  providerStatusCode?: number | null;
  providerErrorBody?: string | null;
  providerErrorKind?: TaskProviderErrorKind | null;
};

export type TaskSummary = {
  id: string;
  userId?: string;
  status: TaskStatus;
  targetWordCount: number | null;
  citationStyle: string | null;
  specialRequirements?: string;
  topic?: string | null;
  requestedChapterCount?: number | null;
  outlineRevisionCount?: number;
  primaryRequirementFileId?: string | null;
  analysisSnapshot?: TaskAnalysisSnapshot | null;
  analysisStatus?: "pending" | "succeeded" | "failed";
  analysisModel?: string | null;
  analysisRetryCount?: number;
  analysisErrorMessage?: string | null;
  analysisTriggerRunId?: string | null;
  analysisRequestedAt?: string | null;
  analysisStartedAt?: string | null;
  analysisCompletedAt?: string | null;
  latestOutlineVersionId?: string | null;
  latestDraftVersionId?: string | null;
  currentCandidateDraftId?: string | null;
  humanizeStatus?: TaskHumanizeStatus;
  humanizeProvider?: string | null;
  humanizeProfileSnapshot?: import("@/src/lib/humanize/humanize-provider").HumanizeProfile | null;
  humanizeDocumentId?: string | null;
  humanizeRetryDocumentId?: string | null;
  humanizeErrorMessage?: string | null;
  humanizeRequestedAt?: string | null;
  humanizeCompletedAt?: string | null;
  quotaReservation?: import("@/src/types/billing").FrozenQuotaReservation;
};

export type TaskFileRole = "requirement" | "background" | "irrelevant" | "unknown";

export type TaskFileRecord = {
  id: string;
  taskId: string;
  userId: string;
  originalFilename: string;
  storagePath: string;
  contentType?: string;
  extractedText: string;
  extractionMethod?: string;
  extractionWarnings?: string[];
  openaiFileId?: string | null;
  openaiUploadStatus?: "pending" | "uploaded" | "failed";
  role: TaskFileRole;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TaskFileRecordInput = Omit<
  TaskFileRecord,
  "id" | "createdAt" | "updatedAt"
> &
  Partial<Pick<TaskFileRecord, "id" | "createdAt" | "updatedAt">>;

export type TaskOutlineVersion = {
  id: string;
  taskId: string;
  userId: string;
  versionNumber: number;
  outline: {
    articleTitle: string;
    targetWordCount: number;
    citationStyle: string;
    sections: Array<{
      title: string;
      summary: string;
      bulletPoints: string[];
    }>;
    chineseMirrorPending: boolean;
  };
  feedback: string;
  isApproved: boolean;
  targetWordCount: number;
  citationStyle: string;
  createdAt: string;
};

export type TaskOutlineVersionInput = Omit<
  TaskOutlineVersion,
  "id" | "createdAt"
> &
  Partial<Pick<TaskOutlineVersion, "id" | "createdAt">>;

export type TaskOutputKind =
  | "final_docx"
  | "reference_report_pdf"
  | "humanized_docx";

export type TaskDraftVersion = {
  id: string;
  taskId: string;
  userId: string;
  versionNumber: number;
  title: string;
  bodyMarkdown: string;
  bodyWordCount: number;
  referencesMarkdown: string;
  isActive: boolean;
  isCandidate: boolean;
  createdAt: string;
};

export type TaskDraftVersionInput = Omit<
  TaskDraftVersion,
  "id" | "createdAt"
> &
  Partial<Pick<TaskDraftVersion, "id" | "createdAt">>;

export type TaskReferenceCheck = {
  id: string;
  taskId: string;
  draftVersionId: string;
  userId: string;
  rawReference: string;
  detectedTitle?: string;
  detectedYear?: string;
  detectedDoi?: string;
  detectedUrl?: string;
  verdict: "matching" | "risky";
  reasoning: string;
  createdAt: string;
};

export type TaskReferenceCheckInput = Omit<
  TaskReferenceCheck,
  "id" | "createdAt"
> &
  Partial<Pick<TaskReferenceCheck, "id" | "createdAt">>;

export type TaskOutputRecord = {
  id: string;
  taskId: string;
  userId: string;
  outputKind: TaskOutputKind;
  storagePath: string;
  isActive: boolean;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
};

export type TaskOutputRecordInput = Omit<
  TaskOutputRecord,
  "id" | "createdAt" | "expiresAt" | "expired" | "isActive"
> &
  Partial<
    Pick<TaskOutputRecord, "id" | "createdAt" | "expiresAt" | "expired" | "isActive">
  >;

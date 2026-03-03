export type TaskStatus =
  | "created"
  | "quota_frozen"
  | "extracting_files"
  | "awaiting_primary_file_confirmation"
  | "building_rule_card"
  | "outline_ready"
  | "awaiting_outline_approval"
  | "drafting"
  | "adjusting_word_count"
  | "verifying_references"
  | "exporting"
  | "deliverable_ready"
  | "humanizing"
  | "humanized_ready"
  | "failed"
  | "expired";

export type TaskSummary = {
  id: string;
  userId?: string;
  status: TaskStatus;
  targetWordCount: number;
  citationStyle: string;
  specialRequirements?: string;
  topic?: string;
  requestedChapterCount?: number | null;
  outlineRevisionCount?: number;
  primaryRequirementFileId?: string | null;
  latestOutlineVersionId?: string | null;
  latestDraftVersionId?: string | null;
  currentCandidateDraftId?: string | null;
};

export type TaskFileRole = "requirement" | "background" | "irrelevant" | "unknown";

export type TaskFileRecord = {
  id: string;
  taskId: string;
  userId: string;
  originalFilename: string;
  storagePath: string;
  extractedText: string;
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
  outputKind: TaskOutputKind;
  storagePath: string;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
};

export type TaskOutputRecordInput = Omit<
  TaskOutputRecord,
  "id" | "createdAt" | "expiresAt" | "expired"
> &
  Partial<Pick<TaskOutputRecord, "id" | "createdAt" | "expiresAt" | "expired">>;

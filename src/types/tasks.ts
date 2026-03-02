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
  primaryRequirementFileId?: string | null;
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

export type TaskOutputKind =
  | "final_docx"
  | "reference_report_pdf"
  | "humanized_docx";

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

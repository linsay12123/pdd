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
  status: TaskStatus;
  targetWordCount: number;
  citationStyle: string;
};

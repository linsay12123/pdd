import type { TaskStatus } from "@/src/types/tasks";

export const allowedTransitions: Record<TaskStatus, TaskStatus[]> = {
  created: [
    "awaiting_primary_file_confirmation",
    "awaiting_outline_approval",
    "failed"
  ],
  awaiting_primary_file_confirmation: ["awaiting_outline_approval", "failed"],
  awaiting_outline_approval: ["drafting", "failed"],
  drafting: ["adjusting_word_count", "failed"],
  adjusting_word_count: ["verifying_references", "failed"],
  verifying_references: ["exporting", "failed"],
  exporting: ["deliverable_ready", "failed"],
  deliverable_ready: ["humanizing", "expired"],
  humanizing: ["humanized_ready", "failed"],
  humanized_ready: ["expired"],
  failed: [],
  expired: []
};

export function canTransition(from: TaskStatus, to: TaskStatus) {
  return allowedTransitions[from].includes(to);
}

export function assertStatusTransition(from: TaskStatus, to: TaskStatus) {
  if (!canTransition(from, to)) {
    throw new Error("Invalid task status transition");
  }
}

export function isTerminalTaskStatus(status: TaskStatus) {
  return allowedTransitions[status].length === 0;
}

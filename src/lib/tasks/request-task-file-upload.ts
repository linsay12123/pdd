import type { OutlineScaffold } from "@/src/lib/ai/prompts/generate-outline";

export type TaskWorkflowTaskPayload = {
  id: string;
  status: string;
  targetWordCount: number;
  citationStyle: string;
  specialRequirements: string;
};

export type TaskWorkflowFilePayload = {
  id: string;
  originalFilename: string;
  role: "requirement" | "background" | "irrelevant" | "unknown";
  isPrimary: boolean;
};

export type TaskWorkflowClassificationPayload = {
  primaryRequirementFileId: string | null;
  backgroundFileIds?: string[];
  irrelevantFileIds?: string[];
  needsUserConfirmation: boolean;
  reasoning?: string;
};

export type TaskWorkflowRuleCardPayload = {
  topic: string;
  targetWordCount: number;
  citationStyle: string;
  chapterCountOverride: number | null;
  mustAnswer: string[];
  gradingPriorities: string[];
  specialRequirements: string;
};

export type TaskWorkflowPayload = {
  task: TaskWorkflowTaskPayload;
  files: TaskWorkflowFilePayload[];
  classification: TaskWorkflowClassificationPayload;
  ruleCard: TaskWorkflowRuleCardPayload | null;
  outline: OutlineScaffold | null;
  message: string;
};

type RequestTaskFileUploadInput = {
  taskId: string;
  files: File[];
  fetchImpl?: typeof fetch;
};

export async function requestTaskFileUpload({
  taskId,
  files,
  fetchImpl = fetch
}: RequestTaskFileUploadInput): Promise<TaskWorkflowPayload> {
  const formData = new FormData();

  for (const file of files) {
    formData.append("files", file);
  }

  const response = await fetchImpl(`/api/tasks/${taskId}/files`, {
    method: "POST",
    body: formData
  });
  const payload = (await response.json().catch(() => null)) as TaskWorkflowPayload | {
    message?: string;
  } | null;

  if (!response.ok) {
    throw new Error(payload?.message ?? "上传文件失败，请稍后再试");
  }

  return payload as TaskWorkflowPayload;
}

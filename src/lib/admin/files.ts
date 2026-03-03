import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import type { TaskOutputKind } from "@/src/types/tasks";

export type AdminFileSummary = {
  id: string;
  taskId: string;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  taskTitle: string;
  outputKind: TaskOutputKind;
  outputLabel: string;
  status: "active" | "expired" | "inactive";
  createdAt: string;
  expiresAt: string | null;
};

type AdminFilesDependencies = {
  shouldUseSupabase?: () => boolean;
  createClient?: typeof createSupabaseAdminClient;
  now?: () => string;
};

type OutputRow = {
  id: string;
  task_id: string;
  user_id: string;
  output_kind: TaskOutputKind;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
};

type TaskRow = {
  id: string;
  title: string | null;
  topic: string | null;
};

type ProfileRow = {
  id: string;
  email: string;
  display_name: string | null;
};

function describeOutputKind(kind: TaskOutputKind) {
  switch (kind) {
    case "final_docx":
      return "最终版文章 Word";
    case "reference_report_pdf":
      return "引用核验 PDF";
    case "humanized_docx":
      return "降AI后版本 Word";
  }
}

export async function listAdminFiles(
  dependencies: AdminFilesDependencies = {}
): Promise<AdminFileSummary[]> {
  const useSupabase =
    (dependencies.shouldUseSupabase ?? shouldUseSupabasePersistence)();

  if (!useSupabase) {
    return [];
  }

  const client = (dependencies.createClient ?? createSupabaseAdminClient)();
  const now = new Date((dependencies.now ?? (() => new Date().toISOString()))());

  const { data: outputRows, error: outputError } = await client
    .from("task_outputs")
    .select("id,task_id,user_id,output_kind,is_active,created_at,expires_at")
    .order("created_at", { ascending: false });

  if (outputError) {
    throw new Error(`读取文件列表失败：${outputError.message}`);
  }

  const outputs = (outputRows ?? []) as OutputRow[];
  const taskIds = [...new Set(outputs.map((output) => output.task_id))];
  const userIds = [...new Set(outputs.map((output) => output.user_id))];

  const [taskResult, profileResult] = await Promise.all([
    taskIds.length
      ? client.from("writing_tasks").select("id,title,topic").in("id", taskIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? client.from("profiles").select("id,email,display_name").in("id", userIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (taskResult.error) {
    throw new Error(`读取文件所属任务失败：${taskResult.error.message}`);
  }

  if (profileResult.error) {
    throw new Error(`读取文件所属用户失败：${profileResult.error.message}`);
  }

  const taskMap = new Map(
    ((taskResult.data ?? []) as TaskRow[]).map((task) => [task.id, task])
  );
  const profileMap = new Map(
    ((profileResult.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile])
  );

  return outputs.map((output) => {
    const expiresAt = output.expires_at;
    const expired =
      expiresAt !== null &&
      !Number.isNaN(new Date(expiresAt).getTime()) &&
      new Date(expiresAt) <= now;
    const profile = profileMap.get(output.user_id);
    const task = taskMap.get(output.task_id);

    return {
      id: output.id,
      taskId: output.task_id,
      userId: output.user_id,
      userEmail: profile?.email ?? "未知邮箱",
      userDisplayName: profile?.display_name?.trim() || "未填写昵称",
      taskTitle: task?.title?.trim() || task?.topic?.trim() || "未生成正式标题",
      outputKind: output.output_kind,
      outputLabel: describeOutputKind(output.output_kind),
      status: !output.is_active ? "inactive" : expired ? "expired" : "active",
      createdAt: output.created_at,
      expiresAt
    };
  });
}

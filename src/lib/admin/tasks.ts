import { shouldUseSupabasePersistence } from "@/src/lib/persistence/runtime-mode";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

export type AdminTaskSummary = {
  id: string;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  status: string;
  title: string;
  targetWordCount: number | null;
  citationStyle: string | null;
  outlineRevisionCount: number;
  createdAt: string;
  expiresAt: string | null;
};

type AdminTasksDependencies = {
  shouldUseSupabase?: () => boolean;
  createClient?: typeof createSupabaseAdminClient;
};

type TaskRow = {
  id: string;
  user_id: string;
  status: string;
  title: string | null;
  topic: string | null;
  target_word_count: number | null;
  citation_style: string | null;
  outline_revision_count: number;
  created_at: string;
  expires_at: string | null;
};

type ProfileRow = {
  id: string;
  email: string;
  display_name: string | null;
};

export async function listAdminTasks(
  dependencies: AdminTasksDependencies = {}
): Promise<AdminTaskSummary[]> {
  const useSupabase =
    (dependencies.shouldUseSupabase ?? shouldUseSupabasePersistence)();

  if (!useSupabase) {
    return [];
  }

  const client = (dependencies.createClient ?? createSupabaseAdminClient)();
  const { data: taskRows, error: taskError } = await client
    .from("writing_tasks")
    .select(
      "id,user_id,status,title,topic,target_word_count,citation_style,outline_revision_count,created_at,expires_at"
    )
    .order("created_at", { ascending: false });

  if (taskError) {
    throw new Error(`读取任务列表失败：${taskError.message}`);
  }

  const tasks = (taskRows ?? []) as TaskRow[];
  const userIds = [...new Set(tasks.map((task) => task.user_id))];

  if (userIds.length === 0) {
    return [];
  }

  const { data: profileRows, error: profileError } = await client
    .from("profiles")
    .select("id,email,display_name")
    .in("id", userIds);

  if (profileError) {
    throw new Error(`读取任务所属用户失败：${profileError.message}`);
  }

  const profileMap = new Map(
    ((profileRows ?? []) as ProfileRow[]).map((profile) => [profile.id, profile])
  );

  return tasks.map((task) => {
    const profile = profileMap.get(task.user_id);

    return {
      id: task.id,
      userId: task.user_id,
      userEmail: profile?.email ?? "未知邮箱",
      userDisplayName: profile?.display_name?.trim() || "未填写昵称",
      status: task.status,
      title: task.title?.trim() || task.topic?.trim() || "未生成正式标题",
      targetWordCount: task.target_word_count,
      citationStyle: task.citation_style,
      outlineRevisionCount: task.outline_revision_count,
      createdAt: task.created_at,
      expiresAt: task.expires_at
    };
  });
}

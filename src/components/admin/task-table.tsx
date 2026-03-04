import { ClipboardList, RefreshCcw, Clock3 } from "lucide-react";
import {
  listAdminTasks,
  type AdminTaskSummary
} from "@/src/lib/admin/tasks";

function formatTaskDate(value: string | null) {
  if (!value) {
    return "尚未设置";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "时间未知";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai"
  }).format(date).replace(/\//g, "-");
}

function describeTaskStatus(status: string) {
  switch (status) {
    case "awaiting_primary_file_confirmation":
      return "等待用户确认主任务文件";
    case "awaiting_outline_approval":
      return "大纲已生成，等待用户确认";
    case "drafting":
      return "正在写正文";
    case "adjusting_word_count":
      return "正在校正字数";
    case "verifying_references":
      return "正在核验引用";
    case "exporting":
      return "正在导出交付文件";
    case "deliverable_ready":
      return "最终交付已准备好";
    case "humanizing":
      return "正在处理自动降AI";
    case "humanized_ready":
      return "降AI后版本已准备好";
    case "failed":
      return "任务失败，后续要补真重试按钮";
    case "expired":
      return "文件已过期";
    default:
      return "任务已创建";
  }
}

export function TaskTableView({ tasks }: { tasks: AdminTaskSummary[] }) {
  return (
    <section className="bg-brand-900/30 p-8 rounded-2xl border border-white/5">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-cream-50 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-gold-400" />
            任务管理
          </h2>
          <p className="text-sm text-brand-700 mt-2">
            这里显示真实任务状态和真实到期时间。重试任务、延长保留这两个按钮我下一步接成真操作。
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-brand-950/50 px-4 py-3 text-right min-w-28">
          <div className="text-xs text-brand-700">当前任务数</div>
          <div className="text-2xl font-bold text-gold-400 font-mono">
            {tasks.length}
          </div>
        </div>
      </div>

      {tasks.length > 0 ? (
        <div className="grid gap-4">
          {tasks.map((task) => (
            <article
              key={task.id}
              className="rounded-2xl border border-white/10 bg-brand-950/40 p-5 grid gap-4"
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div className="grid gap-1">
                  <div className="text-lg font-semibold text-cream-50">
                    {task.title}
                  </div>
                  <div className="text-sm text-brand-700">
                    {task.userDisplayName} · {task.userEmail}
                  </div>
                  <div className="text-xs text-brand-700 font-mono">
                    任务编号：{task.id}
                  </div>
                </div>

                <span className="rounded-full border border-gold-500/30 bg-gold-500/10 px-3 py-1 text-xs font-medium text-gold-400">
                  {describeTaskStatus(task.status)}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/5 bg-brand-900/60 px-4 py-3">
                  <div className="text-xs text-brand-700">目标字数</div>
                  <div className="text-xl font-bold text-cream-50 font-mono">
                    {task.targetWordCount
                      ? task.targetWordCount.toLocaleString("en-US")
                      : "等待分析"}
                  </div>
                </div>
                <div className="rounded-xl border border-white/5 bg-brand-900/60 px-4 py-3">
                  <div className="text-xs text-brand-700">引用格式</div>
                  <div className="text-xl font-bold text-cream-50">
                    {task.citationStyle || "等待分析"}
                  </div>
                </div>
                <div className="rounded-xl border border-white/5 bg-brand-900/60 px-4 py-3">
                  <div className="text-xs text-brand-700">大纲修改次数</div>
                  <div className="text-xl font-bold text-cream-50 font-mono">
                    {task.outlineRevisionCount}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 text-xs text-brand-700">
                <div className="rounded-xl border border-white/5 bg-brand-900/60 px-4 py-3">
                  <div className="inline-flex items-center gap-2 mb-1">
                    <Clock3 className="w-3.5 h-3.5 text-gold-400" />
                    创建时间
                  </div>
                  <div>{formatTaskDate(task.createdAt)}</div>
                </div>
                <div className="rounded-xl border border-white/5 bg-brand-900/60 px-4 py-3">
                  <div className="inline-flex items-center gap-2 mb-1">
                    <RefreshCcw className="w-3.5 h-3.5 text-gold-400" />
                    文件保留到期时间
                  </div>
                  <div>{formatTaskDate(task.expiresAt)}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/5 bg-brand-950/40 px-5 py-6 text-sm text-brand-700 leading-6">
          当前还没有读取到任何真实任务数据。常见原因有两个：
          <br />
          1. 线上数据库里还没有创建任务。
          <br />
          2. 当前环境还没切到真实数据库模式。
        </div>
      )}
    </section>
  );
}

export async function TaskTable() {
  const tasks = await listAdminTasks();

  return <TaskTableView tasks={tasks} />;
}

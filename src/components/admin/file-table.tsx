import { Files, Clock3, FileText } from "lucide-react";
import {
  listAdminFiles,
  type AdminFileSummary
} from "@/src/lib/admin/files";

function formatAdminFileDate(value: string | null) {
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

function describeFileStatus(status: AdminFileSummary["status"]) {
  switch (status) {
    case "active":
      return "可下载";
    case "expired":
      return "已过期";
    case "inactive":
      return "旧版本已停用";
  }
}

export function FileTableView({ files }: { files: AdminFileSummary[] }) {
  return (
    <section className="bg-brand-900/30 p-8 rounded-2xl border border-white/5">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-cream-50 flex items-center gap-2">
            <Files className="w-5 h-5 text-gold-400" />
            文件管理
          </h2>
          <p className="text-sm text-brand-700 mt-2">
            这里显示真实交付文件、所属任务和保留到期时间，方便你先判断哪些文件还有效。
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-brand-950/50 px-4 py-3 text-right min-w-28">
          <div className="text-xs text-brand-700">当前文件数</div>
          <div className="text-2xl font-bold text-gold-400 font-mono">
            {files.length}
          </div>
        </div>
      </div>

      {files.length > 0 ? (
        <div className="grid gap-4">
          {files.map((file) => (
            <article
              key={file.id}
              className="rounded-2xl border border-white/10 bg-brand-950/40 p-5 grid gap-4"
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div className="grid gap-1">
                  <div className="text-lg font-semibold text-cream-50">
                    {file.outputLabel}
                  </div>
                  <div className="text-sm text-brand-700">
                    {file.userDisplayName} · {file.userEmail}
                  </div>
                  <div className="text-xs text-brand-700">{file.taskTitle}</div>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium border ${
                    file.status === "active"
                      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                      : file.status === "expired"
                        ? "border-blue-400/30 bg-blue-400/10 text-blue-300"
                        : "border-white/10 bg-white/5 text-brand-700"
                  }`}
                >
                  {describeFileStatus(file.status)}
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-2 text-xs text-brand-700">
                <div className="rounded-xl border border-white/5 bg-brand-900/60 px-4 py-3">
                  <div className="inline-flex items-center gap-2 mb-1">
                    <FileText className="w-3.5 h-3.5 text-gold-400" />
                    文件编号
                  </div>
                  <div className="font-mono break-all">{file.id}</div>
                </div>
                <div className="rounded-xl border border-white/5 bg-brand-900/60 px-4 py-3">
                  <div className="inline-flex items-center gap-2 mb-1">
                    <FileText className="w-3.5 h-3.5 text-gold-400" />
                    所属任务编号
                  </div>
                  <div className="font-mono break-all">{file.taskId}</div>
                </div>
                <div className="rounded-xl border border-white/5 bg-brand-900/60 px-4 py-3">
                  <div className="inline-flex items-center gap-2 mb-1">
                    <Clock3 className="w-3.5 h-3.5 text-gold-400" />
                    生成时间
                  </div>
                  <div>{formatAdminFileDate(file.createdAt)}</div>
                </div>
                <div className="rounded-xl border border-white/5 bg-brand-900/60 px-4 py-3">
                  <div className="inline-flex items-center gap-2 mb-1">
                    <Clock3 className="w-3.5 h-3.5 text-gold-400" />
                    保留到期时间
                  </div>
                  <div>{formatAdminFileDate(file.expiresAt)}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/5 bg-brand-950/40 px-5 py-6 text-sm text-brand-700 leading-6">
          当前还没有读取到任何真实交付文件。常见原因有两个：
          <br />
          1. 线上还没有任务生成最终文件。
          <br />
          2. 当前环境还没切到真实数据库模式。
        </div>
      )}
    </section>
  );
}

export async function FileTable() {
  const files = await listAdminFiles();

  return <FileTableView files={files} />;
}

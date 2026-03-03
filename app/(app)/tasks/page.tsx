import { Button } from "@/src/components/ui/Button";
import { FileText, Download, Clock, CheckCircle2, AlertCircle, RefreshCw, MoreVertical } from "lucide-react";
import Link from "next/link";
import { buildWorkspaceEntryPath } from "@/src/lib/auth/auth-form";

export default function Tasks() {
  const workspaceEntryPath = buildWorkspaceEntryPath("/workspace");
  const tasks = [
    {
      id: "TSK-20231025-001",
      title: "The Impact of AI on Modern Education",
      status: "completed",
      date: "2023-10-25 14:30",
      points: 500,
      delivered: true
    },
    {
      id: "TSK-20231024-089",
      title: "Marketing Strategy Analysis for Tesla",
      status: "completed",
      date: "2023-10-24 09:15",
      points: 1000,
      delivered: true
    },
    {
      id: "TSK-20231023-042",
      title: "Literature Review on Cognitive Behavioral Therapy",
      status: "failed",
      date: "2023-10-23 16:45",
      points: 0,
      delivered: false
    },
    {
      id: "TSK-20231020-011",
      title: "ESG Reporting Trends in the Tech Industry",
      status: "completed",
      date: "2023-10-20 10:20",
      points: 500,
      delivered: true
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            已完成
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            <AlertCircle className="w-3.5 h-3.5" />
            处理失败
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-brand-800 text-brand-700 border border-white/10">
            <Clock className="w-3.5 h-3.5" />
            处理中
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16 container mx-auto px-6 md:px-12 max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold text-cream-50 mb-2">我的任务</h1>
          <p className="text-brand-700">查看历史生成记录与下载交付文件</p>
        </div>

        <Link href={workspaceEntryPath}>
          <Button className="gap-2">新建任务</Button>
        </Link>
      </div>

      <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-brand-900/50 border-b border-white/10 text-sm font-medium text-cream-100">
                <th className="px-6 py-4">任务信息</th>
                <th className="px-6 py-4">状态</th>
                <th className="px-6 py-4">消耗积分</th>
                <th className="px-6 py-4">创建时间</th>
                <th className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {tasks.map((task) => (
                <tr key={task.id} className="hover:bg-brand-900/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-brand-800 flex items-center justify-center shrink-0 mt-0.5">
                        <FileText className="w-5 h-5 text-gold-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-cream-50 mb-1 line-clamp-1">{task.title}</p>
                        <p className="text-xs text-brand-700 font-mono">{task.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(task.status)}</td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-mono text-cream-100">{task.points > 0 ? `-${task.points}` : "0"}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-brand-700">{task.date}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {task.status === "completed" ? (
                        <>
                          <Button variant="ghost" size="sm" className="h-8 px-2 text-brand-700 hover:text-cream-50">
                            <Download className="w-4 h-4 mr-1.5" />
                            正文
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 px-2 text-brand-700 hover:text-cream-50">
                            <Download className="w-4 h-4 mr-1.5" />
                            报告
                          </Button>
                        </>
                      ) : task.status === "failed" ? (
                        <Button variant="outline" size="sm" className="h-8 border-gold-500/30 text-gold-400">
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                          重新处理
                        </Button>
                      ) : null}

                      <button className="p-1.5 text-brand-700 hover:text-cream-50 rounded-md hover:bg-white/5 transition-colors ml-2">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-white/5 bg-brand-900/20 flex items-center justify-between text-sm text-brand-700">
          <span>共 4 条记录</span>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 rounded bg-brand-800 text-cream-100 disabled:opacity-50" disabled>
              上一页
            </button>
            <button className="px-3 py-1 rounded bg-brand-800 text-cream-100 disabled:opacity-50" disabled>
              下一页
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

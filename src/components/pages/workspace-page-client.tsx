"use client";

import { Button } from "@/src/components/ui/Button";
import { requestConfirmPrimaryFile } from "@/src/lib/tasks/request-confirm-primary-file";
import {
  requestTaskBootstrap,
  type TaskBootstrapPayload
} from "@/src/lib/tasks/request-task-bootstrap";
import type { TaskWorkflowPayload } from "@/src/lib/tasks/request-task-file-upload";
import {
  UploadCloud,
  FileText,
  Settings,
  Zap,
  CheckCircle2,
  AlertCircle,
  Download,
  FileSearch,
  ShieldCheck,
  MessageSquare,
  ArrowRight,
  Sparkles
} from "lucide-react";
import React, { useEffect, useState } from "react";
import Link from "next/link";

type WorkspacePageClientProps = {
  initialQuota: number;
};

type NoticeState = {
  tone: "success" | "error" | "info";
  text: string;
};

type WorkspaceTaskState = TaskWorkflowPayload & {
  frozenQuota?: number;
};

export function WorkspacePageClient({ initialQuota }: WorkspacePageClientProps) {
  const [step, setStep] = useState(1);
  const [files, setFiles] = useState<File[]>([]);
  const [requirements, setRequirements] = useState("");
  const [outlineFeedback, setOutlineFeedback] = useState("");
  const [quota, setQuota] = useState(initialQuota);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [activeTask, setActiveTask] = useState<WorkspaceTaskState | null>(null);
  const [selectedPrimaryFileId, setSelectedPrimaryFileId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmingPrimaryFile, setIsConfirmingPrimaryFile] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function syncWallet() {
      try {
        const response = await fetch("/api/quota/wallet");
        const payload = await response.json();

        if (!cancelled && response.ok) {
          setQuota(payload.wallet.rechargeQuota);
        }
      } catch {
        // Keep the server-rendered quota when the sync request fails.
      }
    }

    void syncWallet();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleStartAnalysis = async () => {
    if (files.length === 0) {
      setNotice({
        tone: "error",
        text: "请先选择至少一个文件，再开始分析。"
      });
      return;
    }

    setIsSubmitting(true);
    setNotice({
      tone: "info",
      text: "系统正在创建任务并读取文件内容，请稍等。"
    });

    try {
      const result = await requestTaskBootstrap({
        specialRequirements: requirements,
        files
      });

      setActiveTask(result);
      setSelectedPrimaryFileId(result.classification.primaryRequirementFileId ?? "");
      setQuota((currentQuota) => Math.max(0, currentQuota - result.frozenQuota));
      setNotice({
        tone: result.classification.needsUserConfirmation ? "info" : "success",
        text: result.message
      });
      setStep(2);
    } catch (error) {
      setNotice({
        tone: "error",
        text:
          error instanceof Error ? error.message : "任务创建失败，请稍后再试。"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmPrimary = async () => {
    if (!activeTask) {
      setNotice({
        tone: "error",
        text: "当前还没有可确认的任务，请先上传文件。"
      });
      return;
    }

    if (!selectedPrimaryFileId) {
      setNotice({
        tone: "error",
        text: "请先选中一份主任务文件。"
      });
      return;
    }

    setIsConfirmingPrimaryFile(true);
    setNotice({
      tone: "info",
      text: "系统正在确认主任务文件并生成第一版大纲。"
    });

    try {
      const result = await requestConfirmPrimaryFile({
        taskId: activeTask.task.id,
        fileId: selectedPrimaryFileId
      });

      setActiveTask({
        ...result,
        frozenQuota: activeTask.frozenQuota
      });
      setSelectedPrimaryFileId(result.primaryRequirementFileId);
      setNotice({
        tone: "success",
        text: result.message
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text:
          error instanceof Error ? error.message : "主任务文件确认失败，请稍后再试。"
      });
    } finally {
      setIsConfirmingPrimaryFile(false);
    }
  };

  const outlineSections = activeTask?.outline?.sections ?? [];

  return (
    <div className="min-h-screen pt-24 pb-16 bg-brand-950">
      <div className="container mx-auto px-6 md:px-12 max-w-6xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 pb-6 border-b border-white/10">
          <div>
            <h1 className="text-3xl font-serif font-bold text-cream-50 mb-2">工作台</h1>
            <p className="text-brand-700">创建新任务，管理生成流程</p>
          </div>

          <div className="flex items-center gap-4 bg-brand-900/50 p-3 rounded-xl border border-white/5">
            <div className="flex flex-col">
              <span className="text-xs text-brand-700 mb-1">当前积分</span>
              <span className="text-xl font-bold text-gold-400 font-mono">{quota.toLocaleString("en-US")}</span>
            </div>
            <div className="w-px h-8 bg-white/10 mx-2" />
            <div className="flex gap-2">
              <Link href="/recharge">
                <Button variant="outline" size="sm" className="border-gold-500/30 text-gold-400">
                  充值额度
                </Button>
              </Link>
              <Link href="/tasks">
                <Button variant="secondary" size="sm">
                  我的任务
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="glass-panel p-6 rounded-2xl border-gold-glow sticky top-24">
              <h3 className="text-lg font-bold text-cream-50 mb-6 flex items-center gap-2">
                <Zap className="w-5 h-5 text-gold-400" />
                任务进度
              </h3>

              <div className="relative border-l border-white/10 ml-3 space-y-8 pb-4">
                {[
                  { id: 1, title: "上传材料与要求", desc: "支持多文件解析", active: step >= 1, current: step === 1 },
                  { id: 2, title: "系统分析", desc: "提取核心要求", active: step > 1, current: false },
                  { id: 3, title: "大纲生成与确认", desc: "需用户手动确认", active: step >= 2, current: step === 2 },
                  { id: 4, title: "正文生成", desc: "严格遵循大纲", active: step > 2, current: false },
                  { id: 5, title: "引用核验", desc: "生成 PDF 报告", active: step > 2, current: false },
                  { id: 6, title: "交付与降AI", desc: "输出最终文件", active: step >= 3, current: step === 3 }
                ].map((item) => (
                  <div key={item.id} className="relative pl-8">
                    <div
                      className={`absolute -left-1.5 top-1 w-3 h-3 rounded-full border-2 ${
                        item.current
                          ? "bg-gold-500 border-gold-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                          : item.active
                            ? "bg-gold-500/50 border-gold-500/50"
                            : "bg-brand-950 border-white/20"
                      }`}
                    />
                    <h4
                      className={`text-sm font-bold mb-1 ${
                        item.current ? "text-gold-400" : item.active ? "text-cream-50" : "text-brand-700"
                      }`}
                    >
                      {item.title}
                    </h4>
                    <p className="text-xs text-brand-700">{item.desc}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-6 border-t border-white/10">
                <div className="bg-brand-950 p-4 rounded-xl border border-white/5">
                  <h4 className="text-sm font-medium text-cream-100 mb-3">预估消耗</h4>
                  <div className="flex justify-between items-center mb-2 text-sm">
                    <span className="text-brand-700">生成文章</span>
                    <span className="text-cream-50 font-mono">500 积分</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-brand-700">自动降AI (可选)</span>
                    <span className="text-cream-50 font-mono">500 积分</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            {step === 1 && (
              <div className="glass-panel p-8 rounded-2xl border border-white/5">
                <h2 className="text-2xl font-bold text-cream-50 mb-6">创建新任务</h2>

                <div className="space-y-8">
                  {notice && (
                    <div
                      className={`rounded-xl border px-4 py-3 text-sm ${
                        notice.tone === "error"
                          ? "border-red-500/30 bg-red-500/10 text-red-200"
                          : notice.tone === "success"
                            ? "border-green-500/30 bg-green-500/10 text-green-200"
                            : "border-gold-500/30 bg-gold-500/10 text-gold-200"
                      }`}
                    >
                      {notice.text}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-cream-100 mb-3">
                      1. 上传参考材料与要求文档
                      <span className="text-xs text-brand-700 ml-2 font-normal">支持 txt, md, docx, pdf, ppt, pptx</span>
                    </label>
                    <div className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:border-gold-500/50 transition-colors bg-brand-950/50 relative">
                      <input type="file" multiple onChange={handleUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      <UploadCloud className="w-10 h-10 text-brand-700 mx-auto mb-4" />
                      <p className="text-sm text-cream-100 mb-2">点击或拖拽文件到此处上传</p>
                      <p className="text-xs text-brand-700">可同时上传多个文件，系统将自动合并分析</p>

                      {files.length > 0 && (
                        <div className="mt-6 text-left">
                          <h4 className="text-xs font-medium text-brand-700 mb-3 uppercase tracking-wider">已选择文件 ({files.length})</h4>
                          <ul className="space-y-2">
                            {files.map((file, i) => (
                              <li key={i} className="flex items-center gap-3 text-sm text-cream-100 bg-brand-900/50 p-2 rounded border border-white/5">
                                <FileText className="w-4 h-4 text-gold-400" />
                                <span className="truncate">{file.name}</span>
                                <span className="text-xs text-brand-700 ml-auto">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-cream-100 mb-3">2. 补充特殊要求 (可选)</label>
                    <textarea
                      value={requirements}
                      onChange={(e) => setRequirements(e.target.value)}
                      placeholder="例如：请重点分析案例 A，字数不少于 3000 字，使用 APA 7th 引用格式..."
                      className="w-full h-32 px-4 py-3 border border-white/10 rounded-xl bg-brand-950/50 text-cream-50 placeholder-brand-700 focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-transparent resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-6 border-t border-white/10">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-sm text-brand-700">
                        <AlertCircle className="w-4 h-4 text-gold-500" />
                        点击开始后，将扣除 <span className="text-gold-400 font-mono font-bold">500</span> 积分
                      </div>
                      <div className="text-xs text-brand-700 ml-6">生成失败全额返还积分</div>
                    </div>
                    <Button
                      size="lg"
                      onClick={() => void handleStartAnalysis()}
                      className="gap-2"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "系统分析中..." : "开始分析并生成大纲"}
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                {notice && (
                  <div
                    className={`rounded-xl border px-4 py-3 text-sm ${
                      notice.tone === "error"
                        ? "border-red-500/30 bg-red-500/10 text-red-200"
                        : notice.tone === "success"
                          ? "border-green-500/30 bg-green-500/10 text-green-200"
                          : "border-gold-500/30 bg-gold-500/10 text-gold-200"
                    }`}
                  >
                    {notice.text}
                  </div>
                )}

                {activeTask?.classification.needsUserConfirmation ? (
                  <div className="glass-panel p-6 rounded-2xl border border-gold-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                      <h2 className="text-xl font-bold text-cream-50 flex items-center gap-2">
                        <FileSearch className="w-5 h-5 text-gold-400" />
                        请确认主任务文件
                      </h2>
                      <span className="px-3 py-1 bg-gold-500/20 text-gold-300 text-xs rounded-full border border-gold-500/30">需要你确认</span>
                    </div>

                    <div className="bg-brand-950 rounded-xl p-6 border border-white/5 space-y-4">
                      <p className="text-sm text-brand-700">
                        系统发现多份文件都像任务要求文档。为了避免选错，请你手动选一份主任务文件，系统再继续生成大纲。
                      </p>

                      <div className="space-y-3">
                        {activeTask.files.map((file) => (
                          <label
                            key={file.id}
                            className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/5 bg-brand-900/50 px-4 py-3 text-sm text-cream-100"
                          >
                            <input
                              type="radio"
                              name="primary-file"
                              value={file.id}
                              checked={selectedPrimaryFileId === file.id}
                              onChange={(event) => setSelectedPrimaryFileId(event.target.value)}
                              className="h-4 w-4 accent-[#ef4444]"
                            />
                            <FileText className="h-4 w-4 text-gold-400" />
                            <span className="flex-1 truncate">{file.originalFilename}</span>
                          </label>
                        ))}
                      </div>

                      <div className="flex items-center justify-end pt-4">
                        <Button
                          onClick={() => void handleConfirmPrimary()}
                          className="gap-2"
                          disabled={isConfirmingPrimaryFile}
                        >
                          {isConfirmingPrimaryFile ? "正在确认..." : "确认主任务文件"}
                          <CheckCircle2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                <div className="glass-panel p-6 rounded-2xl border border-gold-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                    <h2 className="text-xl font-bold text-cream-50 flex items-center gap-2">
                      <FileSearch className="w-5 h-5 text-gold-400" />
                      英文大纲待确认
                    </h2>
                    <span className="px-3 py-1 bg-gold-500/20 text-gold-300 text-xs rounded-full border border-gold-500/30">需用户操作</span>
                  </div>

                  <div className="bg-brand-950 rounded-xl p-6 border border-white/5 mb-6">
                    <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-white/5 text-sm">
                      <div>
                        <span className="text-brand-700 block mb-1">提取标题</span>
                        <span className="text-cream-50 font-medium">
                          {activeTask?.outline?.articleTitle ?? "General Academic Essay: A Structured Analysis"}
                        </span>
                      </div>
                      <div>
                        <span className="text-brand-700 block mb-1">目标字数</span>
                        <span className="text-cream-50 font-mono">
                          {(activeTask?.task.targetWordCount ?? 2000).toLocaleString("en-US")} Words
                        </span>
                      </div>
                      <div>
                        <span className="text-brand-700 block mb-1">引用格式</span>
                        <span className="text-cream-50">
                          {activeTask?.task.citationStyle ?? "APA 7"}
                        </span>
                      </div>
                      <div>
                        <span className="text-brand-700 block mb-1">参考文件数</span>
                        <span className="text-cream-50 font-mono">
                          {activeTask?.files.length ?? files.length} Files
                        </span>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <h3 className="text-sm font-bold text-gold-400 uppercase tracking-wider">Outline Structure</h3>

                      {outlineSections.map((section, i) => (
                        <div key={i}>
                          <h4 className="text-cream-50 font-medium mb-2">
                            {`${i + 1}. ${section.title}`}
                          </h4>
                          <p className="mb-2 text-sm text-brand-700">{section.summary}</p>
                          <ul className="list-disc list-inside text-sm text-brand-700 space-y-1 pl-2">
                            {section.bulletPoints.map((item, j) => (
                              <li key={j}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-cream-100">修改意见 (如需调整大纲，请在此输入)</label>
                    <textarea
                      value={outlineFeedback}
                      onChange={(e) => setOutlineFeedback(e.target.value)}
                      placeholder="例如：请在第三部分增加关于教师角色转变的讨论..."
                      className="w-full h-24 px-4 py-3 border border-white/10 rounded-xl bg-brand-950/50 text-cream-50 placeholder-brand-700 focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-transparent resize-none"
                    />

                    <div className="flex items-center justify-end gap-4 pt-4">
                      <Button variant="secondary" className="gap-2">
                        <Settings className="w-4 h-4" />
                        重新生成大纲
                      </Button>
                      <Button onClick={() => setStep(3)} className="gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        确认大纲并生成正文
                      </Button>
                    </div>
                  </div>
                </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div className="glass-panel p-8 rounded-2xl border-gold-glow relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/10 rounded-full blur-3xl" />

                  <div className="relative z-10 text-center mb-10">
                    <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4 border border-green-500/30">
                      <CheckCircle2 className="w-8 h-8 text-green-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-cream-50 mb-2">任务已完成</h2>
                    <p className="text-brand-700">您的文章与核验报告已生成完毕，请下载查阅。</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                    <div className="bg-brand-950 p-6 rounded-xl border border-white/5 flex flex-col items-center text-center hover:border-gold-500/30 transition-colors">
                      <FileText className="w-10 h-10 text-blue-400 mb-4" />
                      <h3 className="text-lg font-bold text-cream-50 mb-1">最终版正文</h3>
                      <p className="text-xs text-brand-700 mb-6">Word 格式 (.docx) | 2,650 字</p>
                      <Button variant="secondary" fullWidth className="gap-2 mt-auto">
                        <Download className="w-4 h-4" />
                        下载文档
                      </Button>
                    </div>

                    <div className="bg-brand-950 p-6 rounded-xl border border-white/5 flex flex-col items-center text-center hover:border-gold-500/30 transition-colors">
                      <ShieldCheck className="w-10 h-10 text-red-400 mb-4" />
                      <h3 className="text-lg font-bold text-cream-50 mb-1">引用核验报告</h3>
                      <p className="text-xs text-brand-700 mb-6">PDF 格式 (.pdf) | 包含所有来源链接</p>
                      <Button variant="secondary" fullWidth className="gap-2 mt-auto">
                        <Download className="w-4 h-4" />
                        下载报告
                      </Button>
                    </div>
                  </div>

                  <div className="border-t border-white/10 pt-8">
                    <h3 className="text-lg font-bold text-cream-50 mb-6 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-gold-400" />
                      增值服务
                    </h3>

                    <div className="bg-brand-900/50 p-6 rounded-xl border border-gold-500/20 flex flex-col md:flex-row items-center justify-between gap-6">
                      <div>
                        <h4 className="text-base font-bold text-cream-50 mb-2">自动降AI处理</h4>
                        <p className="text-sm text-brand-700 max-w-md">
                          使用专属引擎优化文本特征，使其更贴近人类写作风格。处理完成后将生成一份新的 Word 文档。
                        </p>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <span className="text-xs text-gold-400 mb-2 font-mono">扣除 500 积分</span>
                        <Button className="gap-2">
                          <Zap className="w-4 h-4" />
                          一键降AI
                        </Button>
                      </div>
                    </div>

                    <div className="mt-6 bg-brand-950 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <MessageSquare className="w-5 h-5 text-brand-700" />
                        <span className="text-sm text-cream-100">需要更深度的修改或人工润色？</span>
                      </div>
                      <a href="/#contact-sales" className="text-sm text-gold-400 hover:text-gold-300 font-medium">
                        联系客服人工协助
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

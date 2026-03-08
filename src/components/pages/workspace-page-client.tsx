"use client";

import { Button } from "@/src/components/ui/Button";
import { SupportServicesNote } from "@/src/components/brand/support-services-note";
import { requestConfirmPrimaryFile } from "@/src/lib/tasks/request-confirm-primary-file";
import { requestTaskDownload } from "@/src/lib/tasks/request-task-download";
import { requestOutlineApproval } from "@/src/lib/tasks/request-outline-approval";
import { requestOutlineFeedback } from "@/src/lib/tasks/request-outline-feedback";
import {
  requestHumanize,
  requestHumanizeStatus
} from "@/src/lib/tasks/request-humanize";
import {
  ANALYSIS_POLL_INTERVAL_MS,
  formatElapsedMinutes
} from "@/src/lib/tasks/analysis-progress";
import {
  requestTaskBootstrap,
} from "@/src/lib/tasks/request-task-bootstrap";
import { requestTaskAnalysisStatus } from "@/src/lib/tasks/request-task-analysis-status";
import { requestTaskAnalysisRetry } from "@/src/lib/tasks/request-task-analysis-retry";
import { getTaskAnalysisDisplayState } from "@/src/lib/tasks/analysis-render-mode";
import { isProviderRequestSchemaError } from "@/src/lib/tasks/provider-error";
import type {
  TaskWorkflowHumanizePayload,
  TaskWorkflowPayload
} from "@/src/lib/tasks/request-task-file-upload";
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
  initialActiveTask?: WorkspaceTaskState | null;
};

type NoticeState = {
  tone: "success" | "error" | "info";
  text: string;
};

type WorkspaceTaskState = TaskWorkflowPayload & {
  frozenQuota?: number;
  downloads?: {
    finalDocxOutputId: string | null;
    referenceReportOutputId: string | null;
    humanizedDocxOutputId: string | null;
  };
  finalWordCount?: number;
};

const defaultHumanizeState: TaskWorkflowHumanizePayload = {
  status: "idle",
  provider: "undetectable",
  requestedAt: null,
  completedAt: null,
  errorMessage: null
};

const MAX_UPLOAD_FILE_COUNT = 10;
const MAX_UPLOAD_FILE_BYTES = 25 * 1024 * 1024;
const MAX_UPLOAD_FILE_MB = MAX_UPLOAD_FILE_BYTES / (1024 * 1024);

export function WorkspacePageClient({
  initialQuota,
  initialActiveTask = null
}: WorkspacePageClientProps) {
  const [step, setStep] = useState(() => deriveInitialStep(initialActiveTask));
  const [files, setFiles] = useState<File[]>([]);
  const [requirements, setRequirements] = useState("");
  const [outlineFeedback, setOutlineFeedback] = useState("");
  const [quota, setQuota] = useState(initialQuota);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [activeTask, setActiveTask] = useState<WorkspaceTaskState | null>(initialActiveTask);
  const [selectedPrimaryFileId, setSelectedPrimaryFileId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmingPrimaryFile, setIsConfirmingPrimaryFile] = useState(false);
  const [isRetryingAnalysis, setIsRetryingAnalysis] = useState(false);
  const [isRegeneratingOutline, setIsRegeneratingOutline] = useState(false);
  const [isApprovingOutline, setIsApprovingOutline] = useState(false);
  const [downloadingOutputId, setDownloadingOutputId] = useState<string | null>(null);
  const [isSubmittingHumanize, setIsSubmittingHumanize] = useState(false);

  async function syncWallet() {
    try {
      const response = await fetch("/api/quota/wallet");
      const payload = await response.json();

      if (response.ok) {
        setQuota(payload.wallet.rechargeQuota);
      }
    } catch {
      // Keep the existing wallet snapshot when the sync request fails.
    }
  }

  function mergeTaskHumanizeState(
    currentTask: WorkspaceTaskState,
    nextHumanize?: Partial<TaskWorkflowHumanizePayload> | null,
    nextDownloads?: Partial<NonNullable<WorkspaceTaskState["downloads"]>>
  ): WorkspaceTaskState {
    return {
      ...currentTask,
      humanize: {
        ...(currentTask.humanize ?? defaultHumanizeState),
        ...(nextHumanize ?? {})
      },
      downloads: {
        finalDocxOutputId: currentTask.downloads?.finalDocxOutputId ?? null,
        referenceReportOutputId: currentTask.downloads?.referenceReportOutputId ?? null,
        humanizedDocxOutputId: currentTask.downloads?.humanizedDocxOutputId ?? null,
        ...(nextDownloads ?? {})
      }
    };
  }

  useEffect(() => {
    let cancelled = false;

    async function syncWalletSafely() {
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

    void syncWalletSafely();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeTask || step !== 3) {
      return;
    }

    const currentHumanizeStatus = activeTask.humanize?.status ?? "idle";
    if (!["queued", "processing", "retrying"].includes(currentHumanizeStatus)) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void requestHumanizeStatus({ taskId: activeTask.task.id })
        .then(async (result) => {
          if (cancelled) {
            return;
          }

          setActiveTask((currentTask) => {
            if (!currentTask || currentTask.task.id !== activeTask.task.id) {
              return currentTask;
            }

            return mergeTaskHumanizeState(
              currentTask,
              {
                status: result.humanizeStatus,
                provider: result.provider,
                errorMessage: result.errorMessage,
                requestedAt: result.requestedAt ?? currentTask.humanize?.requestedAt ?? null,
                completedAt:
                  result.completedAt ??
                  (result.humanizeStatus === "completed"
                    ? new Date().toISOString()
                    : currentTask.humanize?.completedAt ?? null)
              },
              {
                humanizedDocxOutputId: result.downloads.humanizedDocxOutputId
              }
            );
          });

          if (result.humanizeStatus === "completed") {
            setNotice({
              tone: "success",
              text: "降AI后版本已经处理完成，现在可以下载。"
            });
            await syncWallet();
            return;
          }

          if (result.humanizeStatus === "failed") {
            setNotice({
              tone: "error",
              text: result.errorMessage ?? "降AI处理失败，请稍后重试。"
            });
            await syncWallet();
          }
        })
        .catch(() => {
          if (cancelled) {
            return;
          }

          setNotice({
            tone: "error",
            text: "读取降AI进度失败，请稍后再试。"
          });
        });
    }, 20_000);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeTask, step]);

  useEffect(() => {
    if (!activeTask || step !== 2) {
      return;
    }

    if (activeTask.analysisStatus !== "pending") {
      return;
    }

    // 超过等待上限后进入“可重试”状态，停止继续自动轮询，避免无意义请求刷屏
    if (activeTask.analysisProgress.canRetry) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void requestTaskAnalysisStatus({ taskId: activeTask.task.id })
        .then((result) => {
          if (cancelled) {
            return;
          }

          setActiveTask((currentTask) => {
            if (!currentTask || currentTask.task.id !== activeTask.task.id) {
              return currentTask;
            }

            return {
              ...currentTask,
              ...result,
              downloads: currentTask.downloads,
              frozenQuota: currentTask.frozenQuota,
              humanize: result.humanize ?? currentTask.humanize ?? defaultHumanizeState
            };
          });

          if (result.analysisStatus === "succeeded") {
            setNotice({
              tone: "success",
              text: result.message
            });
          } else if (result.analysisStatus === "pending" && result.analysisProgress.canRetry) {
            setNotice({
              tone: "error",
              text: result.message
            });
          } else if (result.analysisStatus === "failed") {
            setNotice({
              tone: "error",
              text: result.message
            });
          }
        })
        .catch(() => {
          if (cancelled) {
            return;
          }

          setNotice({
            tone: "error",
            text: "读取分析进度失败，请稍后再试。"
          });
        });
    }, ANALYSIS_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeTask, step]);

  const handleRetryAnalysis = async () => {
    if (!activeTask) {
      return;
    }

    setIsRetryingAnalysis(true);
    setNotice({
      tone: "info",
      text: "系统正在重新分析这批文件，请稍等。"
    });

    try {
      const result = await requestTaskAnalysisRetry({ taskId: activeTask.task.id });
      setActiveTask((currentTask) => {
        if (!currentTask || currentTask.task.id !== activeTask.task.id) {
          return currentTask;
        }

        return {
          ...currentTask,
          ...result,
          downloads: currentTask.downloads,
          frozenQuota: currentTask.frozenQuota,
          humanize: result.humanize ?? currentTask.humanize ?? defaultHumanizeState
        };
      });
      setNotice({
        tone: "info",
        text: result.message
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "重试分析失败，请稍后再试。"
      });
    } finally {
      setIsRetryingAnalysis(false);
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) {
      return;
    }

    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length > MAX_UPLOAD_FILE_COUNT) {
      setNotice({
        tone: "error",
        text: `一次最多上传 ${MAX_UPLOAD_FILE_COUNT} 个文件，请删掉一部分再试。`
      });
      setFiles([]);
      e.target.value = "";
      return;
    }

    const oversizedFile = selectedFiles.find((file) => file.size > MAX_UPLOAD_FILE_BYTES);
    if (oversizedFile) {
      setNotice({
        tone: "error",
        text: `文件 ${oversizedFile.name} 超过 ${MAX_UPLOAD_FILE_MB.toFixed(0)}MB 上限，请压缩后再上传。`
      });
      setFiles([]);
      e.target.value = "";
      return;
    }

    setFiles(selectedFiles);
    setNotice((current) => {
      if (!current || current.tone !== "error") {
        return current;
      }
      return null;
    });
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

      setActiveTask({
        ...result,
        humanize: result.humanize ?? defaultHumanizeState,
        downloads: {
          finalDocxOutputId: null,
          referenceReportOutputId: null,
          humanizedDocxOutputId: null
        }
      });
      setSelectedPrimaryFileId(result.classification.primaryRequirementFileId ?? "");
      setNotice({
        tone:
          result.analysisStatus === "failed"
            ? "error"
            : result.analysisStatus === "pending"
              ? "info"
              : result.classification.needsUserConfirmation
                ? "info"
                : "success",
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
      text: "系统已收到你的主任务文件确认，正在重新分析并生成新大纲。"
    });

    try {
      const result = await requestConfirmPrimaryFile({
        taskId: activeTask.task.id,
        fileId: selectedPrimaryFileId
      });

      setActiveTask((currentTask) =>
        currentTask
          ? {
              ...result,
              humanize: result.humanize ?? currentTask.humanize ?? defaultHumanizeState,
              downloads: currentTask.downloads ?? {
                finalDocxOutputId: null,
                referenceReportOutputId: null,
                humanizedDocxOutputId: null
              },
              frozenQuota: currentTask.frozenQuota
            }
          : currentTask
      );
      setSelectedPrimaryFileId(result.primaryRequirementFileId);
      setNotice({
        tone: result.analysisStatus === "failed" ? "error" : result.analysisStatus === "pending" ? "info" : "success",
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

  const handleRegenerateOutline = async () => {
    if (!activeTask) {
      setNotice({
        tone: "error",
        text: "当前还没有可修改的大纲。"
      });
      return;
    }

    if (!outlineFeedback.trim()) {
      setNotice({
        tone: "error",
        text: "请先输入你希望系统怎么改大纲。"
      });
      return;
    }

    setIsRegeneratingOutline(true);
    setNotice({
      tone: "info",
      text: "系统正在根据你的意见重生成大纲。"
    });

    try {
      const result = await requestOutlineFeedback({
        taskId: activeTask.task.id,
        feedback: outlineFeedback
      });

      setActiveTask((currentTask) =>
        currentTask
          ? {
              ...currentTask,
              task: result.task,
              outline: result.outline,
              humanize: result.humanize ?? currentTask.humanize ?? defaultHumanizeState
            }
          : currentTask
      );
      setNotice({
        tone: "success",
        text: result.message
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text:
          error instanceof Error ? error.message : "重新生成大纲失败，请稍后再试。"
      });
    } finally {
      setIsRegeneratingOutline(false);
    }
  };

  const handleApproveOutline = async () => {
    if (!activeTask) {
      setNotice({
        tone: "error",
        text: "当前还没有可确认的大纲。"
      });
      return;
    }

    setIsApprovingOutline(true);
    setNotice({
      tone: "info",
      text: "系统正在锁定这版大纲，并进入正文写作阶段。"
    });

    try {
      const result = await requestOutlineApproval({
        taskId: activeTask.task.id
      });

      setActiveTask((currentTask) =>
        currentTask
          ? {
              ...currentTask,
              task: result.task,
              downloads: {
                finalDocxOutputId: result.downloads.finalDocxOutputId,
                referenceReportOutputId: result.downloads.referenceReportOutputId,
                humanizedDocxOutputId: currentTask.downloads?.humanizedDocxOutputId ?? null
              },
              finalWordCount: result.finalWordCount,
              humanize: result.humanize ?? currentTask.humanize ?? defaultHumanizeState
            }
          : currentTask
      );
      setNotice({
        tone: "success",
        text: result.message
      });
      setStep(3);
      await syncWallet();
    } catch (error) {
      setNotice({
        tone: "error",
        text:
          error instanceof Error ? error.message : "确认大纲失败，请稍后再试。"
      });
    } finally {
      setIsApprovingOutline(false);
    }
  };

  const handleDownload = async (outputId?: string | null) => {
    if (!activeTask || !outputId) {
      setNotice({
        tone: "error",
        text: "当前这个文件还没有准备好。"
      });
      return;
    }

    setDownloadingOutputId(outputId);

    try {
      const result = await requestTaskDownload({
        taskId: activeTask.task.id,
        outputId
      });

      window.location.assign(result.signedUrl);
    } catch (error) {
      setNotice({
        tone: "error",
        text:
          error instanceof Error ? error.message : "下载失败，请稍后再试。"
      });
    } finally {
      setDownloadingOutputId(null);
    }
  };

  const outlineSections = activeTask?.outline?.sections ?? [];
  const taskFiles = activeTask?.files ?? [];
  const analysis = activeTask?.analysis ?? null;
  const analysisDisplay = getTaskAnalysisDisplayState({
    analysis,
    analysisRenderMode: activeTask?.analysisRenderMode ?? null,
    rawModelResponse: activeTask?.rawModelResponse ?? null,
    providerStatusCode: activeTask?.providerStatusCode ?? null,
    providerErrorBody: activeTask?.providerErrorBody ?? null,
    providerErrorKind: activeTask?.providerErrorKind ?? null
  });
  const analysisRenderMode = analysisDisplay.analysisRenderMode;
  const rawModelResponse = analysisDisplay.rawModelResponse;
  const providerStatusCode = analysisDisplay.providerStatusCode;
  const providerErrorBody = analysisDisplay.providerErrorBody;
  const providerErrorKind = analysisDisplay.providerErrorKind;
  const isProviderSchemaError = isProviderRequestSchemaError({
    providerStatusCode,
    providerErrorBody
  });
  const analysisStatus = activeTask?.analysisStatus ?? "pending";
  const failedAnalysisCard = getFailedAnalysisCard(
    activeTask?.message ?? null,
    analysisRenderMode,
    providerErrorKind,
    isProviderSchemaError
  );
  const analysisProgress = activeTask?.analysisProgress ?? {
    requestedAt: null,
    startedAt: null,
    completedAt: null,
    elapsedSeconds: 0,
    maxWaitSeconds: 600,
    canRetry: false
  };
  const analysisRuntime = activeTask?.analysisRuntime ?? {
    state: "unknown",
    status: null,
    detail: "系统正在确认后台分析任务状态。",
    autoRecovered: false,
    runId: null
  };
  const showAnalysisRetryButton =
    analysisStatus === "failed" ||
    (analysisStatus === "pending" && analysisProgress.canRetry);
  const hasOutline = outlineSections.length > 0;
  const needsPrimaryFileConfirmation = Boolean(
    analysisStatus === "succeeded" &&
      (analysis?.needsUserConfirmation ?? activeTask?.classification.needsUserConfirmation)
  );
  const selectedTaskFileName =
    taskFiles.find((file) => file.id === analysis?.chosenTaskFileId)?.originalFilename ??
    "模型还没最终确认";
  const displayedWordCount =
    analysis?.targetWordCount ?? activeTask?.task.targetWordCount;
  const displayedCitationStyle =
    analysis?.citationStyle ?? activeTask?.task.citationStyle;
  const displayedTopic = analysis?.topic ?? activeTask?.outline?.articleTitle ?? "模型还没给出主题";
  const humanize = activeTask?.humanize ?? defaultHumanizeState;
  const isHumanizeRunning = ["queued", "processing", "retrying"].includes(humanize.status);
  const humanizeButtonBusy = isSubmittingHumanize || isHumanizeRunning;

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
                  <Link href="/billing">
                    <Button variant="outline" size="sm" className="border-gold-500/30 text-gold-400">
                      积分兑换
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
                  <h4 className="text-sm font-medium text-cream-100 mb-3">流程提醒</h4>
                  <p className="text-xs text-brand-700">系统会先分析材料并生成大纲，确认大纲后再进入正式写作。</p>
                  <p className="text-xs text-brand-700 mt-2">系统每次只是查状态，不会每30秒重复调用大模型。</p>
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
                            ? "border-emerald-600/70 bg-emerald-100 text-emerald-950"
                            : "border-gold-500/30 bg-gold-500/10 text-gold-200"
                      }`}
                    >
                      {notice.text}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-cream-100 mb-3">
                      1. 上传参考材料与要求文档
                      <span className="text-xs text-brand-700 ml-2 font-normal">
                        支持 txt, md, docx, pdf, ppt, pptx（最多 {MAX_UPLOAD_FILE_COUNT} 个，每个不超过 {MAX_UPLOAD_FILE_MB.toFixed(0)}MB）
                      </span>
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
                        点击开始后，系统会先分析材料并生成第一版大纲
                      </div>
                      <div className="text-xs text-brand-700 ml-6">确认大纲后才会进入正式写作</div>
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
                          ? "border-emerald-600/70 bg-emerald-100 text-emerald-950"
                          : "border-gold-500/30 bg-gold-500/10 text-gold-200"
                    }`}
                  >
                    {notice.text}
                  </div>
                )}

                {analysisStatus === "pending" ? (
                  <div className="glass-panel p-6 rounded-2xl border border-gold-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
                      <h2 className="text-xl font-bold text-cream-50 flex items-center gap-2">
                        <Settings className="w-5 h-5 text-gold-400" />
                        系统分析中
                      </h2>
                      <span className="px-3 py-1 bg-gold-500/20 text-gold-300 text-xs rounded-full border border-gold-500/30">
                        后台处理中
                      </span>
                    </div>
                    <p className="text-sm text-brand-700">
                      你的文件已经上传成功，系统正在后台完整阅读并生成第一版大纲。你不用一直停在这里，稍后会自动刷新出结果。
                    </p>
                    <p className="text-xs text-brand-700 mt-3">
                      当前已等待：{formatElapsedMinutes(analysisProgress.elapsedSeconds)}（每 30 秒查一次状态，不会反复重跑大模型）
                    </p>
                    <p className="text-xs text-brand-700 mt-2">
                      后台运行态：{analysisRuntime.detail}
                    </p>
                    {showAnalysisRetryButton && (
                      <div className="mt-4 flex items-center gap-3">
                        <Button
                          variant="outline"
                          onClick={() => void handleRetryAnalysis()}
                          disabled={isRetryingAnalysis}
                          className="border-red-400/30 text-red-200"
                        >
                          {isRetryingAnalysis ? "正在重试..." : "一键重试分析"}
                        </Button>
                        <span className="text-xs text-brand-700">
                          不需要重新上传文件，系统会直接用现有文件重跑。
                        </span>
                      </div>
                    )}
                  </div>
                ) : analysisRenderMode === "raw_model" && rawModelResponse ? (
                  <div className="glass-panel p-6 rounded-2xl border border-gold-500/30 shadow-[0_0_15px_rgba(245,158,11,0.08)]">
                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
                      <h2 className="text-xl font-bold text-cream-50 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-gold-400" />
                        模型原始回复
                      </h2>
                      <span className="px-3 py-1 bg-gold-500/10 text-gold-200 text-xs rounded-full border border-gold-500/20">
                        还不能继续正文
                      </span>
                    </div>

                    <div className="space-y-4">
                      <p className="text-sm text-brand-700">
                        这次还没有形成正式大纲，所以系统先把模型原始回复直接展示给你看。只要没有正式大纲，就不能继续正文写作。
                      </p>

                      <div className="rounded-xl border border-white/5 bg-brand-950/80 p-4">
                        <pre className="whitespace-pre-wrap break-words text-sm leading-7 text-cream-100">
                          {rawModelResponse}
                        </pre>
                      </div>

                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          onClick={() => void handleRetryAnalysis()}
                          disabled={isRetryingAnalysis}
                          className="border-gold-500/30 text-gold-200"
                        >
                          {isRetryingAnalysis ? "正在重试..." : "一键重试分析"}
                        </Button>
                        <span className="text-xs text-brand-700">
                          不需要重新上传文件，系统会直接再跑一轮首版大纲。
                        </span>
                      </div>
                    </div>
                  </div>
                ) : analysisRenderMode === "raw_provider_error" && providerErrorBody ? (
                  <div className="glass-panel p-6 rounded-2xl border border-red-500/25 shadow-[0_0_15px_rgba(239,68,68,0.08)]">
                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
                      <h2 className="text-xl font-bold text-cream-50 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-red-300" />
                        {isProviderSchemaError ? "系统请求格式写错了" : "上游接口原始报错"}
                      </h2>
                      <span className="px-3 py-1 bg-red-500/10 text-red-200 text-xs rounded-full border border-red-500/20">
                        还不能继续正文
                      </span>
                    </div>

                    <div className="space-y-4">
                      <p className="text-sm text-brand-700">
                        {isProviderSchemaError
                          ? "这次不是你的文件问题，是系统发给上游接口的格式说明写错了。下面按原样展示报错。只要没有正式大纲，就不能继续正文写作。"
                          : "这次不是程序把内容吞掉了，而是上游接口自己回了这段错误正文。下面按原样展示给你看。只要没有正式大纲，就不能继续正文写作。"}
                      </p>

                      <div className="rounded-xl border border-red-500/15 bg-brand-950/80 p-4 space-y-3">
                        <div className="text-xs uppercase tracking-[0.18em] text-red-200/80">
                          HTTP {providerStatusCode ?? 502}
                        </div>
                        <pre className="whitespace-pre-wrap break-words text-sm leading-7 text-cream-100">
                          {providerErrorBody}
                        </pre>
                      </div>

                      {isProviderSchemaError ? (
                        <p className="text-xs text-brand-700">
                          这类错误不是你反复点重试能解决的，要先把系统这边的请求格式修好。
                        </p>
                      ) : (
                        <div className="flex items-center gap-3">
                          <Button
                            variant="outline"
                            onClick={() => void handleRetryAnalysis()}
                            disabled={isRetryingAnalysis}
                            className="border-red-400/30 text-red-200"
                          >
                            {isRetryingAnalysis ? "正在重试..." : "一键重试分析"}
                          </Button>
                          <span className="text-xs text-brand-700">
                            不需要重新上传文件，系统会直接再跑一轮首版大纲。
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : analysisStatus === "failed" ? (
                  <div className="glass-panel p-6 rounded-2xl border border-red-500/20">
                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
                      <h2 className="text-xl font-bold text-cream-50 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-red-300" />
                        {failedAnalysisCard.title}
                      </h2>
                      <span className="px-3 py-1 bg-red-500/10 text-red-200 text-xs rounded-full border border-red-500/20">
                        可重试
                      </span>
                    </div>

                    <p className="text-sm text-brand-700">
                      {failedAnalysisCard.body}
                    </p>
                    <div className="mt-4">
                      <Button
                        variant="outline"
                        onClick={() => void handleRetryAnalysis()}
                        disabled={isRetryingAnalysis}
                        className="border-red-400/30 text-red-200"
                      >
                        {isRetryingAnalysis ? "正在重试..." : "一键重试分析"}
                      </Button>
                    </div>
                  </div>
                ) : needsPrimaryFileConfirmation ? (
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
                        {taskFiles.map((file) => (
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
                ) : hasOutline ? (
                <div className="glass-panel p-6 rounded-2xl border border-gold-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                    <h2 className="text-xl font-bold text-cream-50 flex items-center gap-2">
                      <FileSearch className="w-5 h-5 text-gold-400" />
                      英文大纲待确认
                    </h2>
                    <span className="px-3 py-1 bg-gold-500/20 text-gold-300 text-xs rounded-full border border-gold-500/30">需用户操作</span>
                  </div>

                  <div className="bg-brand-950 rounded-xl p-6 border border-white/5 mb-6">
                    {analysis && (
                      <div className="mb-6 pb-6 border-b border-white/5">
                        <h3 className="text-sm font-bold text-gold-400 uppercase tracking-wider mb-4">
                          模型分析结果
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-brand-700 block mb-1">模型选中的主任务文件</span>
                            <span className="text-cream-50">{selectedTaskFileName}</span>
                          </div>
                          <div>
                            <span className="text-brand-700 block mb-1">主题</span>
                            <span className="text-cream-50">{displayedTopic}</span>
                          </div>
                          <div>
                            <span className="text-brand-700 block mb-1">目标字数</span>
                            <span className="text-cream-50 font-mono">
                              {typeof displayedWordCount === "number"
                                ? `${displayedWordCount.toLocaleString("en-US")} Words`
                                : "模型还没给出"}
                            </span>
                            {analysis.usedDefaultWordCount && (
                              <p className="text-xs text-brand-700 mt-1">
                                文件里没有明确写字数，本次暂按 2000 字处理。
                              </p>
                            )}
                          </div>
                          <div>
                            <span className="text-brand-700 block mb-1">引用格式</span>
                            <span className="text-cream-50">
                              {displayedCitationStyle ?? "模型还没给出"}
                            </span>
                            {analysis.usedDefaultCitationStyle && (
                              <p className="text-xs text-brand-700 mt-1">
                                文件里没有明确写引用格式，本次暂按 APA 7 处理。
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 space-y-2">
                          <p className="text-sm text-brand-700">{analysis.reasoning}</p>
                          {analysis.appliedSpecialRequirements && (
                            <p className="text-xs text-brand-700">
                              已纳入的特殊要求：{analysis.appliedSpecialRequirements}
                            </p>
                          )}
                          {analysis.warnings.length > 0 && (
                            <div className="rounded-xl border border-amber-500/60 bg-amber-100 px-4 py-3">
                              <p className="text-xs text-amber-950">提醒：{analysis.warnings.join("；")}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-white/5 text-sm">
                      <div>
                        <span className="text-brand-700 block mb-1">提取标题</span>
                        <span className="text-cream-50 font-medium">
                          {activeTask?.outline?.articleTitle ?? "模型还没给出标题"}
                        </span>
                      </div>
                      <div>
                        <span className="text-brand-700 block mb-1">目标字数</span>
                        <span className="text-cream-50 font-mono">
                          {typeof displayedWordCount === "number"
                            ? `${displayedWordCount.toLocaleString("en-US")} Words`
                            : "模型还没给出"}
                        </span>
                      </div>
                      <div>
                        <span className="text-brand-700 block mb-1">引用格式</span>
                        <span className="text-cream-50">
                          {displayedCitationStyle ?? "模型还没给出"}
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

                      {activeTask?.outline?.chineseMirror && (
                        <div className="mt-8 pt-6 border-t border-white/10">
                          <h3 className="text-sm font-bold text-gold-400 uppercase tracking-wider mb-6">中文大纲参考</h3>
                          <p className="text-cream-50 font-medium mb-4">{activeTask.outline.chineseMirror.articleTitle}</p>
                          {activeTask.outline.chineseMirror.sections.map((section, i) => (
                            <div key={i} className="mb-4">
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
                      )}
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
                      <Button
                        variant="secondary"
                        className="gap-2"
                        onClick={() => void handleRegenerateOutline()}
                        disabled={isRegeneratingOutline || activeTask?.task.status === "drafting"}
                      >
                        <Settings className="w-4 h-4" />
                        {isRegeneratingOutline ? "重生成中..." : "重新生成大纲"}
                      </Button>
                      <Button
                        onClick={() => void handleApproveOutline()}
                        className="gap-2"
                        disabled={isApprovingOutline || activeTask?.task.status === "drafting"}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {isApprovingOutline ? "确认中..." : "确认大纲并生成正文"}
                      </Button>
                    </div>
                  </div>
                </div>
                ) : (
                  <div className="glass-panel p-6 rounded-2xl border border-red-500/20">
                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
                      <h2 className="text-xl font-bold text-cream-50 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-red-300" />
                        暂时还没有可展示的大纲
                      </h2>
                      <span className="px-3 py-1 bg-red-500/10 text-red-200 text-xs rounded-full border border-red-500/20">
                        需要处理
                      </span>
                    </div>

                    <p className="text-sm text-brand-700">
                      系统还没有返回一份完整可展示的大纲。通常是模型还没稳定读完材料，或者这次返回格式坏了。你可以直接点“一键重试分析”，不用重新上传文件。
                    </p>
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                {notice && (
                  <div
                    className={`rounded-xl border px-4 py-3 text-sm ${
                      notice.tone === "error"
                        ? "border-red-500/30 bg-red-500/10 text-red-200"
                        : notice.tone === "success"
                          ? "border-emerald-600/70 bg-emerald-100 text-emerald-950"
                          : "border-gold-500/30 bg-gold-500/10 text-gold-200"
                    }`}
                  >
                    {notice.text}
                  </div>
                )}

                <div className="glass-panel p-8 rounded-2xl border-gold-glow relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/10 rounded-full blur-3xl" />

                  <div className="relative z-10 text-center mb-10">
                    <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4 border border-green-500/30">
                      <CheckCircle2 className="w-8 h-8 text-green-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-cream-50 mb-2">任务已完成</h2>
                    <p className="text-brand-700">您的文章与核验报告已生成完毕，请下载查阅。</p>
                  </div>

                  <div
                    className={`grid grid-cols-1 gap-6 mb-10 ${
                      activeTask?.downloads?.humanizedDocxOutputId ? "md:grid-cols-3" : "md:grid-cols-2"
                    }`}
                  >
                    <div className="bg-brand-950 p-6 rounded-xl border border-white/5 flex flex-col items-center text-center hover:border-gold-500/30 transition-colors">
                      <FileText className="w-10 h-10 text-blue-400 mb-4" />
                      <h3 className="text-lg font-bold text-cream-50 mb-1">最终版正文</h3>
                      <p className="text-xs text-brand-700 mb-6">
                        Word 格式 (.docx)
                        {typeof activeTask?.finalWordCount === "number"
                          ? ` | ${activeTask.finalWordCount.toLocaleString("en-US")} words`
                          : ""}
                      </p>
                      <Button
                        variant="secondary"
                        fullWidth
                        className="gap-2 mt-auto"
                        onClick={() => void handleDownload(activeTask?.downloads?.finalDocxOutputId)}
                        disabled={
                          !activeTask?.downloads?.finalDocxOutputId ||
                          downloadingOutputId === activeTask?.downloads?.finalDocxOutputId
                        }
                      >
                        <Download className="w-4 h-4" />
                        {downloadingOutputId === activeTask?.downloads?.finalDocxOutputId
                          ? "准备下载中..."
                          : "下载文档"}
                      </Button>
                    </div>

                    <div className="bg-brand-950 p-6 rounded-xl border border-white/5 flex flex-col items-center text-center hover:border-gold-500/30 transition-colors">
                      <ShieldCheck className="w-10 h-10 text-red-400 mb-4" />
                      <h3 className="text-lg font-bold text-cream-50 mb-1">引用核验报告</h3>
                      <p className="text-xs text-brand-700 mb-6">PDF 格式 (.pdf) | 包含所有来源链接</p>
                      <Button
                        variant="secondary"
                        fullWidth
                        className="gap-2 mt-auto"
                        onClick={() =>
                          void handleDownload(activeTask?.downloads?.referenceReportOutputId)
                        }
                        disabled={
                          !activeTask?.downloads?.referenceReportOutputId ||
                          downloadingOutputId === activeTask?.downloads?.referenceReportOutputId
                        }
                      >
                        <Download className="w-4 h-4" />
                        {downloadingOutputId === activeTask?.downloads?.referenceReportOutputId
                          ? "准备下载中..."
                          : "下载报告"}
                      </Button>
                    </div>

                    {activeTask?.downloads?.humanizedDocxOutputId && (
                      <div className="bg-brand-950 p-6 rounded-xl border border-white/5 flex flex-col items-center text-center hover:border-gold-500/30 transition-colors">
                        <Sparkles className="w-10 h-10 text-gold-400 mb-4" />
                        <h3 className="text-lg font-bold text-cream-50 mb-1">降AI后版本</h3>
                        <p className="text-xs text-brand-700 mb-6">
                          Word 格式 (.docx) | 已完成自动降AI处理
                        </p>
                        <Button
                          variant="secondary"
                          fullWidth
                          className="gap-2 mt-auto"
                          onClick={() =>
                            void handleDownload(activeTask?.downloads?.humanizedDocxOutputId)
                          }
                          disabled={
                            !activeTask?.downloads?.humanizedDocxOutputId ||
                            downloadingOutputId === activeTask?.downloads?.humanizedDocxOutputId
                          }
                        >
                          <Download className="w-4 h-4" />
                          {downloadingOutputId === activeTask?.downloads?.humanizedDocxOutputId
                            ? "准备下载中..."
                            : "下载降AI版本"}
                        </Button>
                      </div>
                    )}
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
                        <div className="mt-3 space-y-1 text-xs text-brand-700">
                          {humanize.status === "idle" && (
                            <p>点击后系统会在后台慢慢处理，完成后这里会自动出现新的下载按钮。</p>
                          )}
                          {isHumanizeRunning && (
                            <p>
                              系统正在后台处理降AI版本。
                              {humanize.status === "retrying"
                                ? " 第一版结果不够稳，系统正在自动重做一次。"
                                : " 你不用一直盯着这个页面，处理好后这里会更新。"}
                            </p>
                          )}
                          {humanize.status === "completed" && (
                            <p>降AI后版本已经准备好，原最终版和降AI后版本都可以分别下载。</p>
                          )}
                          {humanize.status === "failed" && (
                            <p className="text-red-200">
                              {humanize.errorMessage ?? "这次降AI没有成功，但原来的最终版还在，你可以直接重试。"}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <Button
                          className="gap-2"
                          disabled={humanizeButtonBusy}
                          onClick={async () => {
                            if (!activeTask) return;
                            setIsSubmittingHumanize(true);
                            setNotice({ tone: "info", text: "降AI任务已经提交，系统正在后台处理中。" });
                            try {
                              const result = await requestHumanize({ taskId: activeTask.task.id });
                              await syncWallet();
                              setActiveTask((prev) =>
                                prev
                                  ? mergeTaskHumanizeState(
                                      prev,
                                      {
                                        status: result.humanizeStatus,
                                        errorMessage: null,
                                        requestedAt:
                                          prev.humanize?.requestedAt ?? new Date().toISOString(),
                                        completedAt:
                                          result.humanizeStatus === "completed"
                                            ? new Date().toISOString()
                                            : null
                                      },
                                      {
                                        humanizedDocxOutputId:
                                          result.downloads.humanizedDocxOutputId
                                      }
                                    )
                                  : prev
                              );
                              setNotice({
                                tone: result.humanizeStatus === "completed" ? "success" : "info",
                                text: result.message
                              });
                            } catch (err) {
                              setNotice({
                                tone: "error",
                                text: err instanceof Error ? err.message : "降AI处理失败，请稍后再试。"
                              });
                            } finally {
                              setIsSubmittingHumanize(false);
                            }
                          }}
                        >
                          <Zap className="w-4 h-4" />
                          {isSubmittingHumanize
                            ? "提交中..."
                            : humanize.status === "retrying"
                              ? "正在重做..."
                              : isHumanizeRunning
                                ? "正在处理中..."
                                : humanize.status === "completed"
                                  ? "重新生成降AI版本"
                                  : "一键降AI"}
                        </Button>
                      </div>
                    </div>

                    <div className="mt-6 bg-brand-950 p-4 rounded-xl border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="grid gap-3">
                        <div className="flex items-center gap-3">
                          <MessageSquare className="w-5 h-5 text-brand-700" />
                          <span className="text-sm text-cream-100">需要更深度的修改或人工润色？</span>
                        </div>
                        <SupportServicesNote />
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

function deriveInitialStep(task: WorkspaceTaskState | null) {
  if (!task) {
    return 1;
  }

  if (
    task.task.status === "drafting" ||
    task.task.status === "adjusting_word_count" ||
    task.task.status === "verifying_references" ||
    task.task.status === "exporting" ||
    task.task.status === "deliverable_ready" ||
    task.task.status === "humanizing"
  ) {
    return 3;
  }

  return 2;
}

function getFailedAnalysisCard(
  message: string | null,
  analysisRenderMode: WorkspaceTaskState["analysisRenderMode"] | null,
  providerErrorKind: WorkspaceTaskState["providerErrorKind"] | null,
  isProviderSchemaError = false
) {
  const normalized = message?.trim() || "";

  if (isProviderSchemaError) {
    return {
      title: "系统请求格式写错了",
      body: "这次不是你的文件问题，是系统发给上游接口的格式说明写错了。下面会继续展示原始报错，等系统修好后再试。"
    };
  }

  if (analysisRenderMode === "system_error") {
    return {
      title: "上游接口这次没有返回可展示正文",
      body:
        providerErrorKind === "timeout"
          ? "这次已经把请求直接发给上游接口了，但对方没有回可展示内容。你可以直接点下面的一键重试，不需要重新上传文件。"
          : `${normalized || "这次已经把请求直接发给上游接口了，但对方没有回可展示内容。"} 你可以直接点下面的一键重试，不需要重新上传文件。`
    };
  }

  if (normalized.includes("没把文件完整交给分析模型")) {
    return {
      title: "文件还没真正交给模型",
      body: `${normalized} 你可以直接点下面的一键重试，不需要重新上传文件。`
    };
  }

  if (normalized.includes("没能稳定提取出完整写作要求")) {
    return {
      title: "模型有回复，但程序没接成正式要求",
      body: `${normalized} 你可以直接点下面的一键重试，不需要重新上传文件。`
    };
  }

  if (normalized.includes("大纲结构不完整")) {
    return {
      title: "模型有回复，但还没形成正式大纲",
      body: `${normalized} 你可以直接点下面的一键重试，不需要重新上传文件。`
    };
  }

  return {
    title: "本次分析失败",
    body: "系统没能完成这次分析。你可以直接点下面的一键重试，不需要重新上传文件。"
  };
}

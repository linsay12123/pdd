"use client";

import { Button } from "@/src/components/ui/Button";
import { SupportServicesNote } from "@/src/components/brand/support-services-note";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Zap,
  ShieldCheck,
  MessageSquare,
  Users,
  FileSearch,
  Sparkles,
  ThumbsUp,
  HelpCircle,
  BookOpen
} from "lucide-react";
import { Link } from "@/src/lib/router";
import { HOME_SECTION_LINKS } from "@/src/lib/brand/support-links";
import { motion } from "motion/react";

export default function Home() {
  return (
    <div className="pt-24 pb-16">
      <section className="container mx-auto px-6 md:px-12 pt-12 pb-24 relative">
        <div className="absolute inset-0 -z-20 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gold-500/10 rounded-full blur-[120px] -z-10 pointer-events-none" />
        <div className="absolute top-20 right-20 w-32 h-32 bg-blue-500/10 rounded-full blur-[60px] -z-10 pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-800 border border-white/10 text-sm text-gold-400 mb-8">
              <Sparkles className="w-4 h-4" />
              <span>专为接单工作室与学生打造的高效写作引擎</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-[3.25rem] font-serif font-bold leading-[1.2] mb-6 tracking-tight">
              <span className="whitespace-nowrap">批量处理，稳定交付。</span>
              <br className="hidden md:block" />
              <span className="text-gradient-gold whitespace-nowrap">自动高效，安全合规。</span>
            </h1>
            <p className="text-lg text-brand-700 leading-relaxed mb-10">
              上传任务材料 ➔ 系统智能分析 ➔ 生成英文大纲 ➔ 确认后输出正文 ➔ 附带引用核验报告 ➔ 支持一键自动降AI。
              <br className="hidden md:block" />
              <span className="text-cream-100 font-medium mt-2 block">生成文章需500积分 | 一键降AI需500积分</span>
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Link to="/login" className="w-full sm:w-auto">
                <Button size="lg" fullWidth className="gap-2">
                  立即登录工作台
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <a href={HOME_SECTION_LINKS.contactSupport} className="w-full sm:w-auto">
                <Button variant="outline" size="lg" fullWidth className="border-gold-500/50 text-gold-400 hover:bg-gold-500/10">
                  联系客服支持团队购买额度
                </Button>
              </a>
            </div>

            <div className="mt-10 flex items-center gap-6 text-sm text-brand-700">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-gold-500" />
                <span>无需按月订阅</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-gold-500" />
                <span>激活码按需充值</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-gold-500" />
                <span>专属人工客服</span>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.2 }} className="relative">
            <div className="mb-3 flex items-center gap-2 text-gold-500 font-bold ml-2">
              <Sparkles className="w-5 h-5" />
              <span>文章生产工作流程</span>
            </div>
            <div className="glass-panel rounded-2xl p-6 border-gold-glow relative z-10">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <div className="text-xs text-brand-700 font-mono">pindaidai-workspace</div>
              </div>

              <div className="space-y-4">
                <div className="bg-brand-950 rounded-xl p-4 border border-white/5 flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-cream-50 mb-1">1. 任务分析完成</h4>
                    <p className="text-xs text-brand-700">已提取 3 份参考文件，要求字数 2500 字，APA 引用格式。</p>
                  </div>
                </div>

                <div className="bg-brand-950 rounded-xl p-4 border border-gold-500/30 shadow-[0_0_10px_rgba(245,158,11,0.1)] flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-gold-500/20 flex items-center justify-center shrink-0">
                    <FileSearch className="w-4 h-4 text-gold-400" />
                  </div>
                  <div className="w-full">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-medium text-gold-400">2. 英文大纲待确认</h4>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-gold-500/20 text-gold-300">需操作</span>
                    </div>
                    <p className="text-xs text-brand-700 mb-3">系统已生成 5 段式结构大纲，请确认或提出修改意见。</p>
                    <div className="flex gap-2">
                      <Button size="sm" className="h-7 text-xs px-3">
                        确认并生成正文
                      </Button>
                      <Button variant="secondary" size="sm" className="h-7 text-xs px-3">
                        修改大纲
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="bg-brand-950 rounded-xl p-4 border border-white/5 flex items-start gap-4 opacity-50">
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4 text-green-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-cream-50 mb-1">3. 交付物生成</h4>
                    <p className="text-xs text-brand-700">Word 正文与 PDF 引用核验报告。</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -top-6 -right-6 w-24 h-24 bg-gold-500/20 rounded-full blur-2xl" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl" />
          </motion.div>
        </div>
      </section>

      <section className="border-y border-gray-200 bg-gray-50/50 py-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-50" />
        <div className="container mx-auto px-6 md:px-12 relative z-10">
          <div className="flex flex-wrap justify-center gap-x-12 gap-y-6 text-sm font-medium text-brand-700">
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100">
              <CheckCircle2 className="w-4 h-4 text-gold-500" />
              同页完成全流程
            </div>
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100">
              <CheckCircle2 className="w-4 h-4 text-gold-500" />
              先看大纲再写正文
            </div>
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100">
              <CheckCircle2 className="w-4 h-4 text-gold-500" />
              多文件任务分析
            </div>
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100">
              <CheckCircle2 className="w-4 h-4 text-gold-500" />
              支持引用核验报告
            </div>
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100">
              <CheckCircle2 className="w-4 h-4 text-gold-500" />
              自动降AI + 人工客服协助
            </div>
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100">
              <CheckCircle2 className="w-4 h-4 text-gold-500" />
              保证文献真实，杜绝学术不端
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 container mx-auto px-6 md:px-12 relative">
        <div className="absolute top-1/2 left-0 w-64 h-64 bg-red-500/5 rounded-full blur-[80px] -z-10 pointer-events-none" />
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">专为高频写作需求设计</h2>
          <p className="text-brand-700 max-w-2xl mx-auto">无论你是批量接单的工作室，还是需要高质量辅导的学生，拼代代都能提供稳定、可控的交付体验。</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              title: "接单个人",
              icon: <Users className="w-6 h-6 text-gold-500" />,
              pain: "痛点：客户要求多，返工率高，单人产能有限。",
              solution: "解决：先出大纲发给客户确认，锁定结构后再出正文，极大降低返工率。多文件分析让你不用再手动整理长篇要求。"
            },
            {
              title: "小型工作室",
              icon: <Zap className="w-6 h-6 text-gold-500" />,
              pain: "痛点：写手水平参差不齐，交稿时间难控，利润被压缩。",
              solution: "解决：标准化生产流程，统一的引用核验报告提升专业度。激活码充值模式方便团队分配额度，降低生产成本。"
            },
            {
              title: "学生个人",
              icon: <BookOpen className="w-6 h-6 text-gold-500" />,
              pain: "痛点：不知道怎么搭框架，担心AI痕迹重，找不到靠谱工具。",
              solution: "解决：透明的流程让你掌控全局。自带自动降AI功能，更有专属客服提供人工协助，拒绝野路子，安全可靠。"
            }
          ].map((item, i) => (
            <div key={i} className="glass-panel p-8 rounded-2xl hover:-translate-y-2 transition-all duration-300 hover:shadow-[0_15px_40px_rgba(220,38,38,0.1)] group border-t-4 border-t-transparent hover:border-t-gold-500">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-6 border border-red-100 group-hover:scale-110 transition-transform shadow-sm">
                {item.icon}
              </div>
              <h3 className="text-xl font-bold mb-4 text-cream-50">{item.title}</h3>
              <div className="space-y-4 text-sm">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-300" />
                  <p className="text-brand-700 pl-2">{item.pain}</p>
                </div>
                <div className="bg-red-50/50 p-4 rounded-xl border border-red-100 relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gold-500" />
                  <p className="text-cream-100 pl-2 font-medium">{item.solution}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-24 bg-brand-900/30 border-y border-white/5">
        <div className="container mx-auto px-6 md:px-12">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">透明可控的核心流程</h2>
            <p className="text-brand-700 max-w-2xl mx-auto">拒绝“黑盒”生成，每一步都清晰可见，确保最终交付符合预期。</p>
          </div>

          <div className="relative max-w-5xl mx-auto">
            <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-brand-800 -translate-y-1/2 z-0" />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative z-10">
              {[
                { step: "01", title: "上传与分析", desc: "支持多文件上传，系统自动提取核心要求与参考资料。" },
                { step: "02", title: "确认大纲", desc: "生成结构化英文大纲，支持用户修改意见，锁定写作方向。" },
                { step: "03", title: "生成正文", desc: "基于确认的大纲生成完整文章，并附带详细的引用核验报告。" },
                { step: "04", title: "降AI与交付", desc: "支持一键自动降AI，输出最终版 Word 文档，随时联系客服。" }
              ].map((item, i) => (
                <div key={i} className="relative flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-brand-950 border-2 border-gold-500 flex items-center justify-center text-gold-400 font-bold mb-4 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                    {item.step}
                  </div>
                  <h4 className="text-lg font-bold mb-2 text-cream-50">{item.title}</h4>
                  <p className="text-sm text-brand-700">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-24 container mx-auto px-6 md:px-12 relative">
        <div className="absolute top-1/2 right-0 w-64 h-64 bg-gold-500/5 rounded-full blur-[80px] -z-10 pointer-events-none" />
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">强大的功能矩阵</h2>
          <p className="text-brand-700 max-w-2xl mx-auto">为专业交付量身定制的工具集，让每一次写作都精准无误。</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { title: "多文件上传分析", desc: "支持 txt, md, docx, pdf 等格式，一次性读取所有参考资料与要求。", icon: <FileSearch />, tag: "高频使用" },
            { title: "英文大纲先确认", desc: "拒绝盲盒写作。先看结构，确认无误后再生成正文，极大降低返工率。", icon: <CheckCircle2 />, tag: "交付关键" },
            { title: "完整英文正文生成", desc: "基于大纲严格执行，逻辑严密，语言地道，符合学术或商业规范。", icon: <FileText />, tag: "核心能力" },
            { title: "真实文献溯源", desc: "保证文献真实并支持论文主张，从源头杜绝一切学术不端的可能性，让每一处引用都经得起推敲。", icon: <ShieldCheck />, tag: "安全核心" },
            { title: "自动降AI处理", desc: "内置降AI引擎，一键优化文本特征，使其更贴近人类写作风格。", icon: <Sparkles />, tag: "增值服务" },
            { title: "人工客服协助", desc: "遇到复杂需求或特殊情况？专属客服随时待命，提供人工介入支持。", icon: <MessageSquare />, tag: "售后保障" }
          ].map((feature, i) => (
            <div key={i} className="glass-panel p-8 rounded-2xl border border-gray-100 hover:border-gold-500/30 transition-all duration-300 group hover:shadow-[0_10px_30px_rgba(220,38,38,0.08)] bg-white">
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-gold-500 group-hover:scale-110 group-hover:bg-gold-500 group-hover:text-white transition-all duration-300 shadow-sm border border-red-100">
                  {feature.icon}
                </div>
                <span className="text-[10px] px-3 py-1 rounded-full bg-gray-50 text-brand-700 border border-gray-200 font-medium tracking-wider">
                  {feature.tag}
                </span>
              </div>
              <h3 className="text-xl font-bold mb-3 text-cream-50 group-hover:text-gold-600 transition-colors">{feature.title}</h3>
              <p className="text-sm text-brand-700 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="cases" className="py-24 bg-brand-900/30 border-y border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gold-500/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[100px] -z-10 pointer-events-none" />

        <div className="container mx-auto px-6 md:px-12">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">多元化业务场景，全面覆盖</h2>
            <p className="text-brand-700 max-w-2xl mx-auto">从学术辅导到商业报告，看看同行是如何使用拼代代实现降本增效的。</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: "商科市场分析与战略报告",
                type: "商业分析",
                role: "中型接单工作室",
                features: "多文件分析、大纲确认",
                desc: "客户提供了长达 50 页的行业研报和 3 份竞品数据。系统在 2 分钟内完成解析，并生成了包含 PESTEL 和 SWOT 分析的严密大纲。",
                result: "节省 80% 的资料阅读时间，客户对结构一次性通过。"
              },
              {
                title: "计算机科学文献综述",
                type: "学术研究",
                role: "独立研究员/写手",
                features: "真实文献溯源、引用核验",
                desc: "需要引用近 5 年的顶级会议论文（如 CVPR, NeurIPS）。系统精准提取了上传的 15 篇 PDF 核心观点，并在正文中进行了准确的交叉引用。",
                result: "引用格式完全符合 IEEE 要求，附带的核验报告让客户极度信任。"
              },
              {
                title: "留学申请 Personal Statement",
                type: "留学文书",
                role: "高端文书机构",
                features: "大纲确认、人工协助",
                desc: "客户背景复杂，跨专业申请。通过大纲确认环节，机构老师与客户反复打磨了故事主线，随后系统生成了情感充沛的初稿。",
                result: "初稿质量极高，后续人工润色时间从 4 小时缩短至 1 小时。"
              },
              {
                title: "教育学/心理学期末长篇论文",
                type: "期末考核",
                role: "个人接单者",
                features: "自动降AI、完整正文",
                desc: "客户要求文章必须具有‘学生感’，不能有明显的机器生成痕迹。在生成正文后，使用了‘一键降AI’功能，优化了句式复杂度和词汇选择。",
                result: "Turnitin 查重率低于 5%，AI 检测率低于 10%，安全过审。"
              },
              {
                title: "批量生成每周阅读反思 (Reading Response)",
                type: "高频短文",
                role: "小型教育团队",
                features: "批量处理、稳定交付",
                desc: "每周需要为 30 位客户处理不同科目的阅读反思。团队将阅读材料批量上传，系统稳定输出 500-800 字的高质量反思。",
                result: "单人产能提升 400%，彻底告别周末熬夜赶稿，利润率显著提高。"
              },
              {
                title: "ESG 行业发展趋势与合规分析",
                type: "行业长文",
                role: "咨询公司外包",
                features: "大纲确认、人工协助",
                desc: "涉及大量最新的政策法规和数据指标。系统构建了宏大的框架，遇到特殊的数据图表占位要求时，专属客服介入进行了格式微调。",
                result: "结构宏大且稳固，完美契合咨询公司的标准化交付要求。"
              }
            ].map((caseItem, i) => (
              <div key={i} className="glass-panel p-8 rounded-2xl border border-white/5 flex flex-col h-full hover:-translate-y-1 transition-all duration-300 hover:shadow-[0_10px_30px_rgba(220,38,38,0.1)] group">
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-cream-50 mb-3 group-hover:text-gold-400 transition-colors">{caseItem.title}</h3>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-1 rounded-md bg-brand-800 text-brand-700 border border-white/5">{caseItem.type}</span>
                    <span className="px-2 py-1 rounded-md bg-brand-800 text-brand-700 border border-white/5">{caseItem.role}</span>
                  </div>
                </div>
                <div className="space-y-4 text-sm flex-grow">
                  <p className="text-brand-700 leading-relaxed bg-brand-950/50 p-4 rounded-xl border border-white/5">{caseItem.desc}</p>
                  <div className="flex gap-2 items-center">
                    <span className="text-brand-700 shrink-0 text-xs">核心功能：</span>
                    <span className="text-gold-500 text-xs font-medium bg-gold-500/10 px-2 py-1 rounded">{caseItem.features}</span>
                  </div>
                </div>
                <div className="mt-6 pt-5 border-t border-white/5">
                  <div className="flex items-start gap-3 text-sm">
                    <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <ThumbsUp className="w-3 h-3 text-green-500" />
                    </div>
                    <span className="text-cream-100 font-medium leading-relaxed">{caseItem.result}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 container mx-auto px-6 md:px-12">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">用户真实评价</h2>
          <p className="text-brand-700 max-w-2xl mx-auto">来自一线使用者的真实反馈。</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { role: "商科接单用户", quote: "以前最怕客户中途改结构，现在先发大纲给他们确认，扯皮的事情少了一大半。", tag: "减少返工" },
            { role: "留学文书工作室成员", quote: "多文件分析功能太强了，客户发来的一堆要求和参考资料直接扔进去，提取得很准。", tag: "便于批量处理" },
            { role: "本科课程作业用户", quote: "自带的引用核验报告看起来特别专业，交上去心里有底多了。", tag: "更容易过审" },
            { role: "小型教育团队负责人", quote: "买激活码分给团队的人用，成本可控，而且不用绑卡，非常方便。", tag: "管理方便" },
            { role: "高频接单写手", quote: "自动降AI功能很实用，省去了我再去其他平台倒腾的时间，一站式搞定。", tag: "提高交付速度" },
            { role: "教育学硕士用户", quote: "大纲的逻辑很稳，不是那种东拼西凑的感觉，像是有学术底子的人写的。", tag: "大纲更稳" },
            { role: "工作室负责人", quote: "客服回复很快，遇到特殊格式要求的时候，人工协助帮了大忙。", tag: "服务靠谱" },
            { role: "兼职接单学生", quote: "界面很干净，没有那些乱七八糟的广告，用起来感觉很高级、很踏实。", tag: "体验极佳" }
          ].map((feedback, i) => (
            <div key={i} className="glass-panel p-5 rounded-xl border border-white/5 flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-brand-800 flex items-center justify-center">
                  <Users className="w-3 h-3 text-brand-700" />
                </div>
                <span className="text-xs font-medium text-brand-700">{feedback.role}</span>
              </div>
              <p className="text-sm text-cream-100/90 leading-relaxed mb-4 flex-grow">"{feedback.quote}"</p>
              <div className="inline-flex self-start text-[10px] px-2 py-1 rounded bg-gold-500/10 text-gold-400 border border-gold-500/20">{feedback.tag}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-24 bg-brand-900/30 border-y border-white/5">
        <div className="container mx-auto px-6 md:px-12">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">平台交付标准</h2>
            <p className="text-brand-700 max-w-2xl mx-auto">我们不作虚假承诺，只提供稳定、透明、标准化的服务。</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-12 max-w-4xl mx-auto">
            {[
              { title: "规则清晰透明", desc: "没有隐藏收费，流程每一步都清晰可见。" },
              { title: "先大纲后正文", desc: "结构确认后再生成，确保方向绝对正确。" },
              { title: "文档交付明确", desc: "标准 Word 正文与 PDF 格式核验报告。" },
              { title: "积分消耗固定", desc: "生成文章 500 积分，降AI 500 积分，童叟无欺。" },
              { title: "专属客服支持", desc: "工作时间内提供快速响应的人工协助服务。" },
              { title: "适合长期使用", desc: "账号长期有效，激活码按需充值，不过期。" }
            ].map((standard, i) => (
              <div key={i} className="flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-brand-950 border border-white/10 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-5 h-5 text-gold-400" />
                </div>
                <h4 className="text-base font-bold text-cream-50 mb-2">{standard.title}</h4>
                <p className="text-xs text-brand-700">{standard.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact-sales" className="py-24 container mx-auto px-6 md:px-12">
        <div className="glass-panel rounded-3xl p-8 md:p-12 border-gold-glow relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gold-500/10 rounded-full blur-3xl" />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 relative z-10">
            <div>
              <h2 className="text-3xl font-serif font-bold mb-6">额度激活码充值规则</h2>
              <p className="text-brand-700 mb-8 leading-relaxed">拼代代采用“激活码充值”模式，用户登录后输入激活码即可为账户增加积分。同一账号可多次兑换不同激活码，长期有效。</p>

              <div className="space-y-6 mb-8">
                <div>
                  <h4 className="text-sm font-bold text-cream-50 mb-3">四档固定额度：</h4>
                  <div className="flex flex-wrap gap-3">
                    {["1000 积分", "5000 积分", "10000 积分", "20000 积分"].map((tier, i) => (
                      <div key={i} className="px-4 py-2 rounded-lg bg-brand-950 border border-white/10 text-gold-400 font-mono text-sm">
                        {tier}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-cream-50 mb-3">消耗规则：</h4>
                  <div className="flex flex-col gap-2 text-sm text-brand-700">
                    <div className="flex items-center justify-between bg-brand-950 p-3 rounded-lg border border-white/5">
                      <span>生成完整文章（含大纲与核验报告）</span>
                      <span className="text-cream-50 font-mono">-500 积分/次</span>
                    </div>
                    <div className="flex items-center justify-between bg-brand-950 p-3 rounded-lg border border-white/5">
                      <span>执行自动降AI处理</span>
                      <span className="text-cream-50 font-mono">-500 积分/次</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-brand-950 rounded-2xl p-8 border border-white/10 flex flex-col items-center text-center justify-center">
              <h3 className="text-2xl font-bold text-cream-50 mb-2">购买额度请联系客服支持团队</h3>
              <p className="text-sm text-brand-700 mb-8">支持批量合作 / 长期采购 / 专属人工协助</p>

              <div className="w-48 h-48 bg-white rounded-xl p-2 mb-6 flex items-center justify-center overflow-hidden shadow-lg">
                <img src="/qrcode.png" alt="客服微信二维码" className="w-full h-full object-contain" />
              </div>

              <div className="flex flex-col gap-3 mb-6 w-full max-w-xs">
                <div className="bg-brand-900 px-6 py-3 rounded-full border border-white/5 flex justify-between items-center">
                  <span className="text-sm text-brand-700">微信号</span>
                  <span className="font-mono text-gold-400 font-medium tracking-wider">PDDService01</span>
                </div>
                <div className="bg-brand-900 px-6 py-3 rounded-full border border-white/5 flex justify-between items-center">
                  <span className="text-sm text-brand-700">邮箱</span>
                  <span className="font-mono text-gold-400 font-medium tracking-wider text-sm">1318823634@qq.com</span>
                </div>
              </div>

              <div className="mb-6 w-full max-w-md">
                <SupportServicesNote centered />
              </div>

              <p className="text-xs text-brand-700">工作时间：周一至周日 09:00 - 22:00</p>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="py-24 container mx-auto px-6 md:px-12 max-w-4xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">常见问题</h2>
        </div>

        <div className="space-y-4">
          {[
            { q: "平台支持上传哪些格式的文件？", a: "目前支持 txt, md, docx, pdf, ppt, pptx 格式。您可以一次性上传多个文件，系统会自动提取其中的要求和参考内容。" },
            { q: "生成正文前一定会先生成大纲吗？", a: "是的。为了保证交付质量和方向正确，系统强制执行“先大纲、后正文”的流程。您必须确认大纲后，系统才会开始生成正文。" },
            { q: "如果对生成的大纲不满意，可以修改吗？", a: "可以。在大纲确认环节，您可以直接在输入框中提出修改意见，系统会根据您的意见重新调整大纲结构。" },
            { q: "最终生成后会提供哪些文件？", a: "生成完成后，您可以在工作台直接下载最终版的 Word 正文文档，以及一份 PDF 格式的引用核验报告。" },
            { q: "什么是自动降AI功能？", a: "自动降AI是我们提供的一项增值服务。如果您觉得生成的文章AI痕迹较重，可以点击该功能，系统会使用专门的引擎对文本特征进行优化，使其更贴近人类写作风格。每次使用扣除 500 积分。" },
            { q: "如何获取和使用激活码？", a: "请通过页面上的联系方式添加客服支持团队微信购买激活码。获取激活码后，登录您的账号，在“充值”页面输入即可增加对应积分。" },
            { q: "激活码可以重复使用吗？", a: "每个激活码仅限使用一次。但同一个账号可以多次兑换不同的激活码，积分会累计叠加，长期有效。" },
            { q: "如果遇到特殊要求或系统无法处理的情况怎么办？", a: "您可以随时联系我们的专属客服寻求人工协助。我们的团队拥有丰富的处理经验，可以帮您解决复杂或特殊的写作需求。" }
          ].map((faq, i) => (
            <div key={i} className="bg-brand-900/30 p-6 rounded-xl border border-white/5">
              <h4 className="text-base font-bold text-cream-50 mb-2 flex items-start gap-3">
                <HelpCircle className="w-5 h-5 text-gold-400 shrink-0 mt-0.5" />
                {faq.q}
              </h4>
              <p className="text-sm text-brand-700 pl-8 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

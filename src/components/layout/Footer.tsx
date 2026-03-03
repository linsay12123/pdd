import Link from "next/link";
import { Mail, MessageCircle } from "lucide-react";
import { HOME_SECTION_LINKS } from "@/src/lib/brand/support-links";

export default function Footer() {
  return (
    <footer className="bg-brand-950 border-t border-white/10 pt-16 pb-8">
      <div className="container mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden">
                <img src="/logo.png" alt="拼代代 Logo" className="w-full h-full object-cover" />
              </div>
              <span className="text-xl font-serif font-bold tracking-tight text-cream-50">拼代代</span>
            </Link>
            <p className="text-brand-700 text-sm leading-relaxed mb-6">
              专为接单工作室与个人用户打造的自动化写作 SaaS 平台。 先大纲后正文，稳定交付，提升效率。
            </p>
            <div className="flex items-center gap-4 text-brand-700">
              <a href={HOME_SECTION_LINKS.contactSupport} className="hover:text-gold-400 transition-colors" title="联系客服微信">
                <MessageCircle className="w-5 h-5" />
              </a>
              <a href="mailto:1318823634@qq.com" className="hover:text-gold-400 transition-colors" title="发送邮件">
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-cream-50 font-semibold mb-6">产品功能</h4>
            <ul className="space-y-4 text-sm text-brand-700">
              <li>
                <a href={HOME_SECTION_LINKS.features} className="hover:text-gold-400 transition-colors">
                  多文件分析
                </a>
              </li>
              <li>
                <a href={HOME_SECTION_LINKS.features} className="hover:text-gold-400 transition-colors">
                  英文大纲生成
                </a>
              </li>
              <li>
                <a href={HOME_SECTION_LINKS.features} className="hover:text-gold-400 transition-colors">
                  正文与引用核验
                </a>
              </li>
              <li>
                <a href={HOME_SECTION_LINKS.features} className="hover:text-gold-400 transition-colors">
                  自动降AI处理
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-cream-50 font-semibold mb-6">使用说明</h4>
            <ul className="space-y-4 text-sm text-brand-700">
              <li>
                <Link href="/recharge" className="hover:text-gold-400 transition-colors">
                  激活码充值
                </Link>
              </li>
              <li>
                <a href={HOME_SECTION_LINKS.faq} className="hover:text-gold-400 transition-colors">
                  常见问题
                </a>
              </li>
              <li>
                <Link href="/workspace" className="hover:text-gold-400 transition-colors">
                  进入工作台
                </Link>
              </li>
              <li>
                <Link href="/tasks" className="hover:text-gold-400 transition-colors">
                  我的任务
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-cream-50 font-semibold mb-6">联系客服支持团队</h4>
            <div className="bg-brand-900/50 rounded-xl p-4 border border-white/5">
              <p className="text-sm text-brand-700 mb-3">
                购买额度激活码、批量采购或寻求人工协助，请联系专属客服支持团队。
              </p>
              <a
                href={HOME_SECTION_LINKS.contactSupport}
                className="inline-flex items-center gap-2 text-gold-400 text-sm font-medium hover:text-gold-300 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                联系客服支持团队
              </a>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-brand-700 text-xs">© {new Date().getFullYear()} 拼代代 (Pin Dai Dai). All rights reserved.</p>
          <div className="flex items-center gap-6 text-xs text-brand-700">
            <Link href="/legal/disclaimer" className="hover:text-cream-50 transition-colors">
              免责声明
            </Link>
            <Link href="/legal/privacy" className="hover:text-cream-50 transition-colors">
              隐私政策
            </Link>
            <Link href="/legal/terms" className="hover:text-cream-50 transition-colors">
              服务条款
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

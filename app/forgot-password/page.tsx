import Link from "next/link";
import { ForgotPasswordForm } from "@/src/components/auth/forgot-password-form";

type ForgotPasswordPageProps = {
  searchParams?: Promise<{
    message?: string;
  }>;
};

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};

  return (
    <div className="min-h-screen pt-24 pb-16 flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-2 mb-6 group">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden shadow-[0_0_20px_rgba(220,38,38,0.2)] group-hover:scale-105 transition-transform">
              <img src="/logo.png" alt="拼代代 Logo" className="w-full h-full object-cover" />
            </div>
          </Link>
          <h1 className="text-3xl font-serif font-bold text-cream-50 mb-2">找回密码</h1>
          <p className="text-brand-700">输入注册邮箱，我们会把重置密码邮件发给您</p>
        </div>

        <div className="glass-panel p-8 rounded-2xl border-gold-glow">
          <ForgotPasswordForm initialStatusText={resolvedSearchParams.message ?? ""} />
        </div>

        <div className="mt-8 text-center">
          <a href="/#contact-sales" className="text-xs text-brand-700 hover:text-cream-50 transition-colors">
            需要人工客服协助？联系客服支持团队
          </a>
        </div>
      </div>
    </div>
  );
}

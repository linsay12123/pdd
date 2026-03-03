import { LoginForm } from "@/src/components/auth/login-form";
import Link from "next/link";

type LoginPageProps = {
  searchParams?: Promise<{
    redirect?: string;
    message?: string;
  }>;
};

export default async function Login({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const redirectTo = resolvedSearchParams.redirect ?? "/workspace";
  const initialStatusText = resolvedSearchParams.message ?? "";

  return (
    <div className="min-h-screen pt-24 pb-16 flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-2 mb-6 group">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden shadow-[0_0_20px_rgba(220,38,38,0.2)] group-hover:scale-105 transition-transform">
              <img src="/logo.png" alt="拼代代 Logo" className="w-full h-full object-cover" />
            </div>
          </Link>
          <h1 className="text-3xl font-serif font-bold text-cream-50 mb-2">欢迎回来</h1>
          <p className="text-brand-700">登录拼代代，继续您的专业创作</p>
        </div>

        <div className="glass-panel p-8 rounded-2xl border-gold-glow">
          <LoginForm redirectTo={redirectTo} initialStatusText={initialStatusText} />
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

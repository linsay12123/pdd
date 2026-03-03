import Link from "next/link";
import { AuthCompletePageClient } from "@/src/components/auth/auth-complete-page-client";
import { normalizeRedirectTarget } from "@/src/lib/auth/auth-form";

type WorkspaceEntryPageProps = {
  searchParams?: Promise<{
    next?: string;
  }>;
};

export default async function WorkspaceEntryPage({ searchParams }: WorkspaceEntryPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const nextPath = normalizeRedirectTarget(resolvedSearchParams.next);

  return (
    <div className="min-h-screen pt-24 pb-16 flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-2 mb-6 group">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden shadow-[0_0_20px_rgba(220,38,38,0.2)] group-hover:scale-105 transition-transform">
              <img src="/logo.png" alt="拼代代 Logo" className="w-full h-full object-cover" />
            </div>
          </Link>
          <h1 className="text-3xl font-serif font-bold text-cream-50 mb-2">正在进入工作台</h1>
          <p className="text-brand-700">我们正在核对您的登录状态，很快就会带您进入拼代代工作台。</p>
        </div>

        <div className="glass-panel p-8 rounded-2xl border-gold-glow">
          <AuthCompletePageClient nextPath={nextPath} />
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

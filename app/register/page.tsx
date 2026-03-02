import { RegisterForm } from "@/src/components/auth/register-form";
import Link from "next/link";

export default function Register() {

  return (
    <div className="min-h-screen pt-24 pb-16 flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-2 mb-6 group">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden shadow-[0_0_20px_rgba(220,38,38,0.2)] group-hover:scale-105 transition-transform">
              <img src="/logo.png" alt="拼代代 Logo" className="w-full h-full object-cover" />
            </div>
          </Link>
          <h1 className="text-3xl font-serif font-bold text-cream-50 mb-2">注册拼代代</h1>
          <p className="text-brand-700">开启高效、稳定的写作交付体验</p>
        </div>

        <div className="glass-panel p-8 rounded-2xl border-gold-glow">
          <RegisterForm />
        </div>
      </div>
    </div>
  );
}

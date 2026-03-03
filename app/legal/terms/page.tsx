export default function TermsPage() {
  return (
    <div className="min-h-screen pt-28 pb-16 px-6">
      <div className="mx-auto max-w-3xl glass-panel rounded-2xl p-8 border border-white/10">
        <h1 className="text-3xl font-serif font-bold text-cream-50 mb-4">服务条款</h1>
        <div className="space-y-4 text-sm leading-7 text-brand-700">
          <p>用户注册并使用拼代代，即表示同意按照平台展示的流程、积分规则与交付范围使用相关功能。</p>
          <p>生成文章、人工协助、检测报告与其他增值服务，均以当前页面说明与客服支持团队最终确认内容为准。</p>
          <p>若账号存在异常使用、恶意攻击、违规用途或影响平台稳定的行为，拼代代有权限制功能、冻结账号或停止服务。</p>
        </div>
      </div>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen pt-28 pb-16 px-6">
      <div className="mx-auto max-w-3xl glass-panel rounded-2xl p-8 border border-white/10">
        <h1 className="text-3xl font-serif font-bold text-cream-50 mb-4">隐私政策</h1>
        <div className="space-y-4 text-sm leading-7 text-brand-700">
          <p>拼代代会保存为完成任务所必需的账号信息、额度信息、任务记录与交付文件，并按照平台当前规则管理保留期限。</p>
          <p>用户上传的内容仅用于完成对应任务、生成交付物、排查故障与提供售后支持，不会被公开展示或出售给第三方。</p>
          <p>如需提前删除任务文件、延长保留时间或咨询数据处理细节，请联系拼代代客服支持团队。</p>
        </div>
      </div>
    </div>
  );
}

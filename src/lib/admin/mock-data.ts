export const adminUsers = [
  {
    id: "usr_001",
    email: "client-a@example.com",
    role: "user",
    status: "active",
    currentQuota: 12000
  },
  {
    id: "usr_002",
    email: "client-b@example.com",
    role: "user",
    status: "frozen",
    currentQuota: 1400
  }
];

export const activationCodeRows = [
  {
    code: "PDD-1000-A19F3C2D",
    tier: "1000 积分",
    status: "未使用",
    usedBy: "待兑换"
  },
  {
    code: "PDD-5000-CE28B441",
    tier: "5000 积分",
    status: "已使用",
    usedBy: "client-a@example.com"
  }
];

export const adminTasks = [
  {
    id: "task_001",
    userEmail: "client-a@example.com",
    status: "deliverable_ready",
    expiresAt: "2026-03-05 10:00"
  },
  {
    id: "task_002",
    userEmail: "client-b@example.com",
    status: "failed",
    expiresAt: "2026-03-05 18:30"
  }
];

export const adminFiles = [
  {
    id: "file_001",
    taskId: "task_001",
    kind: "final_docx",
    expiresAt: "2026-03-05 10:00",
    status: "active"
  },
  {
    id: "file_002",
    taskId: "task_002",
    kind: "reference_report_pdf",
    expiresAt: "2026-03-05 18:30",
    status: "active"
  }
];

export const pricingRows = [
  {
    label: "生成文章",
    costPer1000Words: 230
  },
  {
    label: "自动降AI",
    costPer1000Words: 250
  }
];

export const financeRows = [
  {
    label: "今日发出的激活码",
    value: "18 个"
  },
  {
    label: "今日已兑换激活码",
    value: "11 个"
  },
  {
    label: "今日消耗额度",
    value: "6500 点"
  }
];

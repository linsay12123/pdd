export const adminUsers = [
  {
    id: "usr_001",
    email: "client-a@example.com",
    role: "user",
    status: "active",
    rechargeQuota: 120,
    subscriptionQuota: 80
  },
  {
    id: "usr_002",
    email: "client-b@example.com",
    role: "user",
    status: "frozen",
    rechargeQuota: 14,
    subscriptionQuota: 0
  }
];

export const adminOrders = [
  {
    id: "ord_001",
    provider: "alipay",
    amount: "$49.00",
    quota: 60,
    status: "paid"
  },
  {
    id: "ord_002",
    provider: "crypto",
    amount: "$99.00",
    quota: 140,
    status: "pending_manual_check"
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
    label: "2000 字文章生成",
    quota: 20,
    paymentMethod: "全渠道"
  },
  {
    label: "2000 字自动降AI",
    quota: 10,
    paymentMethod: "仅任务完成后可用"
  }
];

export const financeRows = [
  {
    label: "今日充值收入",
    value: "$168.00"
  },
  {
    label: "待人工确认稳定币",
    value: "2 笔"
  },
  {
    label: "今日消耗额度",
    value: "96 点"
  }
];

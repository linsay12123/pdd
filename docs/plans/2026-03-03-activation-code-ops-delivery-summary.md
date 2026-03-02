# 拼代代PDD：激活码运营闭环交付总结（2026-03-03）

## 1. 本次交付范围

本轮已经把“充值方式”统一到你确认的方案：**额度激活码**，并完成了管理员与用户两端的完整闭环。

- 管理员端：
  - 批量生成激活码（单次最多 50 个）
  - 激活码列表筛选（全部 / 已使用 / 未使用）
  - 关键词检索
  - CSV 导出
- 用户端：
  - 额度中心输入激活码兑换
  - 页面显示明确失败原因
  - 兑换成功后积分实时刷新
- API 端：
  - 管理员创建 / 列表 / 导出接口
  - 用户兑换接口
  - 用户钱包读取接口

## 2. 关键接口清单

- `POST /api/admin/activation-codes/create`
- `GET /api/admin/activation-codes/list`
- `GET /api/admin/activation-codes/export`
- `POST /api/quota/redeem-code`
- `GET /api/quota/wallet`

## 3. 关键规则（已落地）

- 激活码档位固定：`1000 / 5000 / 10000 / 20000`
- 单次生成数量上限：`50`
- 激活码一次性使用：已使用后不可重复兑换
- 用户兑换失败时返回明确可读原因（例如：不存在、已使用、参数不完整）
- 充值页不再展示在线支付入口

## 4. 主要代码变更点

- 激活码领域模型与仓储：增加档位/数量校验、状态筛选、关键词筛选
- 后台 API：补齐管理员权限校验与筛选参数处理
- 新增 CSV 导出 API
- 额度中心组件接入真实兑换流程（不再是静态输入框）
- 文档更新为“激活码模式”，去除旧在线支付描述

## 5. 验证证据（本地）

已执行并通过以下验证：

- `corepack pnpm exec vitest run tests/unit/activation-codes.test.ts tests/unit/activation-code-admin-routes.test.ts tests/unit/activation-code-export-route.test.ts`
- `corepack pnpm exec vitest run tests/unit/quota-wallet-route.test.ts`
- `corepack pnpm exec vitest run tests/unit/billing-page.test.tsx`
- `corepack pnpm exec vitest run tests/unit/admin-shell.test.tsx`
- `corepack pnpm exec vitest run tests/smoke/homepage.test.ts tests/unit/billing-page.test.tsx`

## 6. 当前已知限制

- 现在用户身份在兑换链路里还是“开发阶段占位方式”（`demo-user`），下一步应接入真实登录会话用户 ID。
- 虽然 Supabase 已新增 `activation_codes` 表结构，但应用侧激活码/钱包仓储当前仍以内存实现为主，生产环境要切到数据库持久化并加事务保证。

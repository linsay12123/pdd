# 拼代代PDD（自动写作平台）

这是“拼代代PDD”的主项目代码。

现在系统已经切换成你确认的模式：

- 用户端：登录后在同一个界面完成上传、生成、下载
- 额度体系：只用“额度激活码”充值，不走线上支付
- 扣费规则：生成文章扣 500，自动降AI扣 500
- 后台端：管理员可批量生成激活码、筛选、导出 CSV、查看使用状态
- 交付端：成稿文档 + 引用核验结果 + 降AI后版本下载位
- 文件策略：下载有效期 3 天，过期后自动失效

## 你现在能直接用的功能

- 用户工作台：`/workspace`
- 额度中心：`/billing`（`/recharge` 是同页面别名）
- 管理后台：`/admin`
- 任务列表：`/tasks`

管理员侧“激活码管理”支持：

- 一次最多生成 50 个激活码
- 固定四档：1000 / 5000 / 10000 / 20000
- 状态筛选：全部 / 未使用 / 已使用
- 关键词检索：按激活码片段搜
- CSV 导出：按当前筛选结果导出

## 当前业务规则（已落地）

- 用户账号是长期可登录，不再按“月卡时长”激活
- 充值方式是额度激活码，同一个码只能使用一次
- 文档下载有效期固定 3 天
- 自动降AI走 StealthGPT 接口
- 核验报告按你要求：不区分“部分支持/完全支持”，只做标题与摘要匹配和相关性说明

## 本地检查命令

```bash
corepack pnpm lint
corepack pnpm test
corepack pnpm exec next build --webpack
corepack pnpm test:e2e
```

## 相关手册

- 上线检查：`docs/runbooks/launch-checklist.md`
- 额度异常处理：`docs/runbooks/payment-recovery.md`
- 任务失败处理：`docs/runbooks/task-failure-recovery.md`
- Supabase 真正落库：`docs/runbooks/supabase-persistence-quickstart.md`

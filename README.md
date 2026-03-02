# 拼代代PDD（自动写作平台）

这是“拼代代PDD”的主项目代码。

## 当前项目边界

- 当前唯一主项目：这个 Next.js 工程
- 当前唯一线上版本：Vercel 上已部署的拼代代PDD站点
- 当前前端外观：已经确认保留，不再重做设计
- 历史前端来源目录：`/Users/jeffo/Desktop/自动写作/拼代代-pdd`
- 历史目录只作为参考素材来源，不再继续开发

## 当前已确认的产品规则

- 额度体系：只用“额度激活码”充值，不走线上支付
- 扣费规则：生成文章扣 500，自动降AI扣 500
- 文件策略：下载有效期 3 天，过期后自动失效
- 自动降AI走 StealthGPT

## 当前优先补完

当前线上版本已经有你确认的前端样式，但后端核心流程还在补完中。当前优先补完的是真实业务能力，而不是重做前端：

- 真实登录
- 真实注册
- 真实余额读取
- 真实激活码兑换
- 真实任务创建与大纲确认
- 真实正文、核验与交付链路
- 真实管理员权限与后台数据

## 当前已可复用的基础能力

- 用户端页面骨架：`/workspace`
- 额度中心页面骨架：`/billing`
- 管理后台页面骨架：`/admin`
- 任务列表页面骨架：`/tasks`
- 激活码表结构与兑换 RPC 基础
- Word 导出基础
- PDF 报告导出基础
- StealthGPT 接口基础

## 当前仍在补完的关键点

- 登录和注册页目前正在从演示跳转切换成真实会话
- 工作台与额度页正在从写死积分切换成真实钱包数据
- 任务创建、大纲确认、正文生成链路仍在逐步接通
- 后台部分页面当前仍含 mock 数据，需切到真实数据库查询
- 在线支付已关闭，只保留激活码模式

## 本地检查命令

```bash
corepack pnpm lint
corepack pnpm test
corepack pnpm exec next build --webpack
corepack pnpm test:e2e
```

## 相关手册

- 上线检查：`docs/runbooks/launch-checklist.md`
- 当前范围说明：`docs/runbooks/current-scope.md`
- 额度异常处理：`docs/runbooks/payment-recovery.md`
- 任务失败处理：`docs/runbooks/task-failure-recovery.md`
- Supabase 真正落库：`docs/runbooks/supabase-persistence-quickstart.md`

# 自动写作平台

这是你这套“文章自动写作产品”的主项目代码。

目前这份代码已经把核心骨架搭起来了：

- 用户端单页面工作台
- 后台中控页面
- 多种支付入口
- 订阅额度发放
- 三天过期清理
- 引用核验报告下载位
- StealthGPT 自动降 AI 入口
- 人工降 AI 微信提示位
- 失败任务人工重试
- 上线检查手册

## 现在做到什么程度

已经在本地做好的：

- 页面骨架、接口骨架、任务状态流转
- Supabase 数据表第一版和订阅表
- Stripe 充值和订阅同步
- 支付宝、微信支付骨架
- 手动稳定币收款（USDT / USDC，Base / Ethereum / Solana）
- 管理员后台页面
- 交付文件三天失效
- 监控日志、计数器、人工重试工具
- 端到端演示页：`/workspace/demo`

还需要你后面提供的真实信息：

- Stripe 正式密钥
- 支付宝商家参数
- 微信支付商家参数
- 你的 6 个稳定币收款地址
- 生产环境正式域名

## 本地检查命令

```bash
corepack pnpm lint
corepack pnpm test
corepack pnpm build
corepack pnpm test:e2e
```

## 重要业务规则

- 默认字数是 `2000`
- 默认引用格式是 `APA 7`
- 如果上传文件里写了明确字数和引用格式，就必须按文件要求
- 自动降 AI 只处理正文，不处理参考文献
- 下载文件保留 `3` 天，到期后文件失效，但任务记录保留
- 订阅额度月底清零，次月重新发放；用户自己充值的额度不清零

## 当前支付策略

- 海外银行卡：`Stripe`
- 海外稳定币：手动确认到账，不做链上自动回调
- 国内收款：`支付宝` + `微信支付`

## 运营查看入口

- 用户工作台：`/workspace`
- 验收演示页：`/workspace/demo`
- 后台中控：`/admin`
- 充值页：`/billing`

## 相关手册

- 上线检查：`docs/runbooks/launch-checklist.md`
- 支付账号开通：`docs/runbooks/payment-account-onboarding.md`
- 支付异常处理：`docs/runbooks/payment-recovery.md`
- 任务失败处理：`docs/runbooks/task-failure-recovery.md`

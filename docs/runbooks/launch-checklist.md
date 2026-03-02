# 上线检查清单

## 1. 环境变量

- 确认 `.env.local` 已填写 Supabase、OpenAI、StealthGPT 所需密钥。
- 确认 `STEALTHGPT_API_KEY` 已设置，否则“自动降AI”会失败。

## 2. 数据库

- 运行 `corepack pnpm exec supabase migration list --db-url <你的数据库地址>`，确认本地和线上迁移编号一致。
- 如有新表或新字段，先执行 `corepack pnpm exec supabase db push --db-url <你的数据库地址>`。
- 人工检查一次以下核心表是否存在且字段完整：
  - `activation_codes`
  - `quota_wallets`
  - `tasks`
  - `task_outputs`

## 3. 后台任务

- 在 Trigger.dev 后台确认 `TRIGGER_SECRET_KEY` 已配置。
- 确认三天过期清理任务已经启用。

## 4. 激活码流程

- 进后台 `/admin`，生成一批测试激活码（建议 1000 档 * 2 个）。
- 用一个测试用户去 `/billing` 兑换第一个码，确认积分实时增加。
- 再次兑换同一个码，确认页面显示“已被使用”之类明确失败原因。
- 管理员侧筛选“已使用”，确认能看到对应使用记录。
- 点击导出 CSV，确认下载内容和页面筛选一致。

## 5. 交付文件

- 跑一次完整样例任务，确认能产出 Word 成稿。
- 确认引用核验 PDF 能正常导出，排版没有重叠。
- 确认下载链接三天后会失效，但任务历史还保留。

## 6. 上线前人工走查

- 用普通用户账号走一遍上传到下载的流程。
- 用管理员账号打开中控后台，确认能看到用户、激活码、任务和财务汇总。
- 手动点一次“自动降AI”，确认按钮、下载位和“人工降ai 请联系客服”提示都正常显示。

# 当前线上正式主流程地图

这份清单只写“现在正式在线使用的主流程”，不写已经废弃的旧分支。

## 1. 创建任务

- 入口：
  `/api/tasks/create`
- 主要写入：
  `writing_tasks`
- 当前规则：
  任务创建时先不强行写死字数和引用格式，这两个值允许先为空。
- 必备依赖：
  `NEXT_PUBLIC_SUPABASE_URL`
  `SUPABASE_SERVICE_ROLE_KEY`

## 2. 上传文件并生成第一版大纲

- 入口：
  `/api/tasks/[taskId]/files`
- 主要读写：
  `task_files`
  `writing_tasks`
  `outline_versions`
- 当前规则：
  文件会尽量提字，但最终任务要求和大纲都由大模型统一分析后回填。

## 3. 用户确认主任务文件

- 入口：
  `/api/tasks/[taskId]/files/confirm-primary`
- 主要读写：
  `task_files`
  `writing_tasks`
  `outline_versions`
- 当前规则：
  只有模型拿不准主任务文件时，才进入这一步。

## 4. 用户改纲

- 入口：
  `/api/tasks/[taskId]/outline/feedback`
- 主要读写：
  `writing_tasks`
  `task_files`
  `outline_versions`
- 当前规则：
  用户原话、上一版大纲、原始文件，一起交给大模型重做，不再由程序自己猜意思。

## 5. 用户确认大纲，进入正式写作

- 入口：
  `/api/tasks/[taskId]/outline/approve`
- 主要读写：
  `writing_tasks`
  `quota_wallets`
  `quota_ledger_entries`
  `draft_versions`
  `reference_checks`
  `task_outputs`
- 当前规则：
  这一刻才真正扣积分。
  正文生成、字数校正、引用核验、导出，都属于正式写作链路。
- 说明：
  这条接口现在只允许走真实数据库，不再允许偷偷退回本地临时仓库。

## 6. 用户取消任务

- 入口：
  `/api/tasks/[taskId]/cancel`
- 主要读写：
  `writing_tasks`
  `quota_wallets`
  `quota_ledger_entries`
- 当前规则：
  只有允许取消的状态才能取消。
  如果任务上挂着需要返还的积分，会先返还，再把任务改成失败。
- 说明：
  这条接口现在也只允许走真实数据库。

## 7. 自动降AI

- 入口：
  `/api/tasks/[taskId]/humanize`
- 主要读写：
  `writing_tasks`
  `draft_versions`
  `quota_wallets`
  `quota_ledger_entries`
  `task_outputs`
- 当前规则：
  现在不再返回“已排队”的假成功。
  如果真实服务密钥没配好，会直接明确提示“功能未启用”。
  如果密钥已配置，就会直接完成一次真实降AI处理，并生成新的 Word 文件。
- 必备依赖：
  `STEALTHGPT_API_KEY`

## 8. 下载交付文件

- 入口：
  `/api/tasks/[taskId]/outputs/[outputId]/download`
- 主要读取：
  `task_outputs`
- 当前规则：
  只允许下载属于当前用户自己的有效文件。

## 9. 健康检查

- 入口：
  `/api/health`
- 主要检查：
  环境变量
  数据库连接
  核心表是否存在
  数据库结构是否跟当前写作流程一致
  旧支付/旧状态是否清干净
  自动降AI服务是否真的可用

## 10. 现在这条线上主流程的硬规则

- 正式接口不再允许靠本地临时仓库冒充线上数据。
- 如果功能还没真启用，就直接报未启用，不再返回假成功。
- 健康检查必须说真话，不能因为页面能打开就假装一切正常。

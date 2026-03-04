# 当前数据库审计清单

这份清单只写“现在真正还在用的东西”，避免以后代码已经换了，数据库里还留着旧世界。

## 1. 现在正式保留的表

- `profiles`
  用来存用户基础信息和管理员角色。
- `quota_wallets`
  用来存每个用户当前剩余积分。
- `quota_ledger_entries`
  用来存积分加减流水。
- `activation_codes`
  用来存激活码本身、档位和使用记录。
- `writing_tasks`
  用来存写作任务主记录。
- `task_files`
  用来存用户上传的文件、提取文字、OpenAI 文件编号和分析辅助信息。
- `outline_versions`
  用来存每一版大纲。
- `draft_versions`
  用来存正文版本。
- `reference_checks`
  用来存引用核验结果。
- `task_outputs`
  用来存最终可下载文件。
- `admin_audit_logs`
  用来存后台管理操作日志。

## 2. 这次已经废弃并删除的旧表

- `pricing_plans`
  老的在线价格表，当前业务已经不用。
- `orders`
  老的在线支付订单表，当前业务已经不用。
- `payment_attempts`
  老的支付回调记录表，当前业务已经不用。
- `subscriptions`
  老的月订阅表，当前业务已经不用。

## 3. 现在正式保留的任务状态

- `created`
  任务刚创建，还没上传文件。
- `awaiting_primary_file_confirmation`
  模型觉得主任务文件不够确定，等用户确认。
- `awaiting_outline_approval`
  模型已经给出大纲，等用户确认或改纲。
- `drafting`
  正在写正文。
- `adjusting_word_count`
  正在调字数。
- `verifying_references`
  正在核验引用。
- `exporting`
  正在导出交付文件。
- `deliverable_ready`
  最终文件已准备好。
- `humanizing`
  正在做自动降AI。
- `humanized_ready`
  降AI后版本已准备好。
- `failed`
  任务失败。
- `expired`
  可下载文件已过期。

## 4. 这次已经废弃并迁走的旧状态

- `quota_frozen`
  旧流程里“先冻结积分再分析”的中间态，已经废弃。
- `extracting_files`
  旧流程里本地自己读文件的中间态，已经废弃。
- `building_rule_card`
  旧流程里程序自己整理要求的中间态，已经废弃。
- `outline_ready`
  旧流程里大纲待确认的旧名字，已经统一改成 `awaiting_outline_approval`。

## 5. 历史数据迁移规则

- 老的 `outline_ready` 任务，统一迁成 `awaiting_outline_approval`。
- 老的 `quota_frozen`、`extracting_files`、`building_rule_card` 任务，统一收成 `failed`。
- 老的 `quota_frozen` 如果还挂着冻结积分，会先按任务里存的冻结记录退回钱包，再补一条 `task_release` 流水，最后再改成 `failed`。

## 6. 现在的硬规则

- 创建任务时，`writing_tasks.target_word_count` 和 `writing_tasks.citation_style` 允许先为空。
- 这两个值要等上传文件后，由大模型分析结果再回填。
- 线上健康检查必须同时确认两件事：
  - 新结构已经到位。
  - 旧支付表、旧支付类型、旧任务状态都已经清干净。
- 自动降AI如果要算“正式可用”，还必须看到真实服务密钥已经配置好。

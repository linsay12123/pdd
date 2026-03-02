# Supabase 真正落库操作清单（拼代代PDD）

这份清单是给不会编程也能照着做的版本。  
“真正落库”就是：激活码和积分不再放在程序内存里，而是写进 Supabase 云数据库。

## 第 1 步：准备 3 个值（在 Supabase 后台复制）

打开 Supabase 项目设置：

1. `Project URL`（项目地址）
2. `anon key`（公开 key）
3. `service_role key`（管理员 key，权限最高）

注意：

- `service_role key` 只能放服务端环境变量，不能写到前端公开代码里。

## 第 2 步：填到项目环境变量

在项目根目录的 `.env.local` 里，确认有这三行：

```env
NEXT_PUBLIC_SUPABASE_URL=你的ProjectURL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的anonkey
SUPABASE_SERVICE_ROLE_KEY=你的service_role_key
```

## 第 3 步：把数据库迁移推到云端

在终端进入项目目录后运行：

```bash
cd "/Users/jeffo/Desktop/自动写作/.worktrees/bootstrap-shell"
```

如果你的数据库密码里有特殊字符（比如 `!`），建议用下面这段命令：

```bash
set -a; source .env.local; set +a
ENCODED_PASS=$(python3 - <<'PY'
import os, urllib.parse
print(urllib.parse.quote(os.environ['SUPABASE_DB_PASSWORD'], safe=''))
PY
)
DB_URL="postgresql://postgres.${SUPABASE_PROJECT_REF}:${ENCODED_PASS}@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"
corepack pnpm exec supabase db push --db-url "$DB_URL" --include-all
```

如果显示 `Finished supabase db push.`，说明推送成功。

## 第 4 步：验证数据库是否就绪

继续运行：

```bash
corepack pnpm exec supabase db push --db-url "$DB_URL" --dry-run --include-all
```

如果看到 `Remote database is up to date.`，说明云端数据库已经和本地迁移同步。

## 第 5 步：验证应用本身

在项目目录运行：

```bash
corepack pnpm lint
corepack pnpm test
corepack pnpm exec next build --webpack
```

三个都通过，就代表“代码 + 数据库结构”都已经对齐。

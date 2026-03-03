# 拼代代账号注册与找回密码 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让拼代代的用户可以直接注册并进入工作台，同时提供完整、稳定的忘记密码邮件重置流程，并清理旧邮箱确认链路遗留问题。

**Architecture:** 关闭 Supabase 的注册邮箱确认，把注册改成“创建后直接登录”；找回密码阶段继续使用 Supabase 邮件能力，但通过站内固定回跳页完成密码重置。前端只做清晰提示与状态控制，所有关键行为都通过最小改动接到现有 Supabase 浏览器客户端和站内路由。

**Tech Stack:** Next.js App Router、React、Supabase Auth、Vitest、TypeScript

---

### Task 1: 写注册流程的失败测试

**Files:**
- Modify: `/Users/jeffo/Desktop/自动写作/.worktrees/bootstrap-shell/tests/unit/register-flow.test.tsx`
- Modify: `/Users/jeffo/Desktop/自动写作/.worktrees/bootstrap-shell/tests/unit/auth-pages.test.tsx`

**Step 1: Write the failing test**

补三类测试：

- 注册成功时不再要求邮箱确认
- 已注册邮箱时返回“去登录/忘记密码”的引导
- 注册页不再出现“重新发送确认邮件”

**Step 2: Run test to verify it fails**

Run:

```bash
cd '/Users/jeffo/Desktop/自动写作/.worktrees/bootstrap-shell'
pnpm test tests/unit/register-flow.test.tsx tests/unit/auth-pages.test.tsx
```

Expected:

- FAIL，原因是当前代码仍然保留了注册确认邮件逻辑

**Step 3: Write minimal implementation**

只修改注册相关的辅助函数和页面断言，不碰忘记密码。

**Step 4: Run test to verify it passes**

Run:

```bash
cd '/Users/jeffo/Desktop/自动写作/.worktrees/bootstrap-shell'
pnpm test tests/unit/register-flow.test.tsx tests/unit/auth-pages.test.tsx
```

Expected:

- PASS

**Step 5: Commit**

```bash
git add tests/unit/register-flow.test.tsx tests/unit/auth-pages.test.tsx
git commit -m "test: cover direct signup flow"
```

### Task 2: 把注册改成直接成功并自动登录

**Files:**
- Modify: `/Users/jeffo/Desktop/自动写作/.worktrees/bootstrap-shell/src/components/auth/register-form.tsx`
- Modify: `/Users/jeffo/Desktop/自动写作/.worktrees/bootstrap-shell/src/lib/auth/register-flow.ts`

**Step 1: Write the failing test**

确保测试要求：

- 注册成功后提示“正在进入工作台”
- 不再展示“去邮箱确认”
- 不再展示“重新发送确认邮件”

**Step 2: Run test to verify it fails**

Run same test command as Task 1.

Expected:

- FAIL，原因是注册仍然走邮箱确认提示

**Step 3: Write minimal implementation**

- 删除注册时的确认邮件提示逻辑
- 删除重新发送确认邮件函数和按钮
- 在 `signUp` 成功后，继续调用登录逻辑或使用返回会话直接进入 `/workspace`
- 已注册邮箱使用中文清晰提示

**Step 4: Run test to verify it passes**

Run:

```bash
cd '/Users/jeffo/Desktop/自动写作/.worktrees/bootstrap-shell'
pnpm test tests/unit/register-flow.test.tsx tests/unit/auth-pages.test.tsx
```

Expected:

- PASS

**Step 5: Commit**

```bash
git add src/components/auth/register-form.tsx src/lib/auth/register-flow.ts
git commit -m "feat: allow direct signup without email confirmation"
```

### Task 3: 写忘记密码流程的失败测试

**Files:**
- Create: `/Users/jeffo/Desktop/自动写作/.worktrees/bootstrap-shell/tests/unit/password-reset-flow.test.tsx`
- Modify: `/Users/jeffo/Desktop/自动写作/.worktrees/bootstrap-shell/tests/unit/auth-pages.test.tsx`

**Step 1: Write the failing test**

覆盖：

- 登录页显示可点击的“忘记密码？”
- 找回密码页存在邮箱输入和发送按钮
- 重置密码页存在新密码和确认密码输入
- 忘记密码调用 Supabase 重置邮件时使用站内回跳地址

**Step 2: Run test to verify it fails**

Run:

```bash
cd '/Users/jeffo/Desktop/自动写作/.worktrees/bootstrap-shell'
pnpm test tests/unit/password-reset-flow.test.tsx tests/unit/auth-pages.test.tsx
```

Expected:

- FAIL，因为页面和辅助函数还不存在

**Step 3: Write minimal implementation**

先只加最小页面骨架和函数签名。

**Step 4: Run test to verify it passes**

Run same command again.

Expected:

- PASS

**Step 5: Commit**

```bash
git add tests/unit/password-reset-flow.test.tsx tests/unit/auth-pages.test.tsx
git commit -m "test: cover password reset flow"
```

### Task 4: 实现找回密码页面和邮件发送

**Files:**
- Create: `/Users/jeffo/Desktop/自动写作/.worktrees/bootstrap-shell/app/forgot-password/page.tsx`
- Create: `/Users/jeffo/Desktop/自动写作/.worktrees/bootstrap-shell/src/components/auth/forgot-password-form.tsx`
- Modify: `/Users/jeffo/Desktop/自动写作/.worktrees/bootstrap-shell/src/components/auth/login-form.tsx`
- Modify: `/Users/jeffo/Desktop/自动写作/.worktrees/bootstrap-shell/src/lib/auth/register-flow.ts`

**Step 1: Write the failing test**

要求：

- 登录页“忘记密码？”跳到 `/forgot-password`
- 表单点击后调用 Supabase `resetPasswordForEmail`
- 成功文案统一使用模糊提示，不暴露邮箱是否注册

**Step 2: Run test to verify it fails**

Run:

```bash
cd '/Users/jeffo/Desktop/自动写作/.worktrees/bootstrap-shell'
pnpm test tests/unit/password-reset-flow.test.tsx
```

Expected:

- FAIL

**Step 3: Write minimal implementation**

- 新增忘记密码页面
- 新增忘记密码表单
- 把登录页右上角占位文案换成真链接
- 发送邮件时使用正式站内重置密码回跳地址

**Step 4: Run test to verify it passes**

Run same command again.

Expected:

- PASS

**Step 5: Commit**

```bash
git add app/forgot-password/page.tsx src/components/auth/forgot-password-form.tsx src/components/auth/login-form.tsx src/lib/auth/register-flow.ts
git commit -m "feat: add forgot password request flow"
```

### Task 5: 实现重置密码页面和保存新密码

**Files:**
- Create: `/Users/jeffo/Desktop/自动写作/.worktrees/bootstrap-shell/app/reset-password/page.tsx`
- Create: `/Users/jeffo/Desktop/自动写作/.worktrees/bootstrap-shell/src/components/auth/reset-password-form.tsx`
- Modify: `/Users/jeffo/Desktop/自动写作/.worktrees/bootstrap-shell/app/auth/confirm/route.ts`

**Step 1: Write the failing test**

要求：

- 邮件回来后能进入重置密码页
- 两次密码不一致时阻止提交
- 保存成功后跳回登录页并展示成功提示
- 链接无效时给中文错误提示

**Step 2: Run test to verify it fails**

Run:

```bash
cd '/Users/jeffo/Desktop/自动写作/.worktrees/bootstrap-shell'
pnpm test tests/unit/password-reset-flow.test.tsx
```

Expected:

- FAIL

**Step 3: Write minimal implementation**

- 新增重置密码页面
- 新增重置密码表单
- 使用 Supabase 更新密码
- 调整邮件回跳逻辑，让忘记密码邮件进入重置密码页，而不是工作台

**Step 4: Run test to verify it passes**

Run same command again.

Expected:

- PASS

**Step 5: Commit**

```bash
git add app/reset-password/page.tsx src/components/auth/reset-password-form.tsx app/auth/confirm/route.ts
git commit -m "feat: add reset password completion flow"
```

### Task 6: 处理旧半注册邮箱脏数据

**Files:**
- Create: `/Users/jeffo/Desktop/自动写作/.worktrees/bootstrap-shell/scripts/fix-stale-auth-user.mjs`
- Create: `/Users/jeffo/Desktop/自动写作/.worktrees/bootstrap-shell/tests/unit/fix-stale-auth-user.test.ts`
- Modify: `/Users/jeffo/Desktop/自动写作/.worktrees/bootstrap-shell/src/lib/supabase/admin.ts`

**Step 1: Write the failing test**

要求：

- 能识别指定邮箱是否处于旧未确认状态
- 能安全删除旧记录或给出明确提示

**Step 2: Run test to verify it fails**

Run:

```bash
cd '/Users/jeffo/Desktop/自动写作/.worktrees/bootstrap-shell'
pnpm test tests/unit/fix-stale-auth-user.test.ts
```

Expected:

- FAIL

**Step 3: Write minimal implementation**

- 用 Supabase 管理员客户端查询邮箱用户
- 只针对明确的旧未确认记录执行清理
- 输出中文提示，告诉操作者处理结果

**Step 4: Run test to verify it passes**

Run same command again.

Expected:

- PASS

**Step 5: Commit**

```bash
git add scripts/fix-stale-auth-user.mjs tests/unit/fix-stale-auth-user.test.ts src/lib/supabase/admin.ts
git commit -m "feat: add stale auth user cleanup script"
```

### Task 7: 调整 Supabase 配置说明和上线文档

**Files:**
- Modify: `/Users/jeffo/Desktop/自动写作/.worktrees/bootstrap-shell/docs/runbooks/launch-checklist.md`
- Modify: `/Users/jeffo/Desktop/自动写作/.worktrees/bootstrap-shell/README.md`

**Step 1: Write the failing test**

如果已有文档快照测试，就更新文档断言；如果没有，就只补人工核对步骤。

**Step 2: Run test to verify it fails**

Run:

```bash
cd '/Users/jeffo/Desktop/自动写作/.worktrees/bootstrap-shell'
pnpm test tests/smoke/homepage.test.ts
```

Expected:

- 仅当文档断言有变化时失败；否则进入实现

**Step 3: Write minimal implementation**

文档明确写清：

- 注册邮箱确认已关闭
- 忘记密码邮件仍启用
- Site URL 与 Redirect URL 该怎么配
- 旧半注册邮箱如何清理

**Step 4: Run test to verify it passes**

Run:

```bash
cd '/Users/jeffo/Desktop/自动写作/.worktrees/bootstrap-shell'
pnpm test
pnpm lint
```

Expected:

- 全绿

**Step 5: Commit**

```bash
git add docs/runbooks/launch-checklist.md README.md
git commit -m "docs: update auth setup and recovery runbook"
```

### Task 8: 最终整体验证

**Files:**
- No code changes required unless verification fails

**Step 1: Run full automated verification**

```bash
cd '/Users/jeffo/Desktop/自动写作/.worktrees/bootstrap-shell'
pnpm test
pnpm lint
```

Expected:

- 全部通过

**Step 2: Manual verification checklist**

逐条验证：

- 新邮箱注册后直接进入工作台
- 已注册邮箱再次注册时出现正确引导
- 忘记密码邮件能收到
- 邮件点回站内重置密码页
- 新密码可登录
- 指定 QQ 邮箱清理后可重新注册

**Step 3: Final commit if needed**

```bash
git status --short
```

如果还有未提交改动，再按实际改动补提交。

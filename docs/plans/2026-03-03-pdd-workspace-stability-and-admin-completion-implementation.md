# 拼代代工作台稳定性与中控台补全 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让登录/注册后进入工作台稳定可用，并把中控台和额度页从假数据补成真实后台，同时保持全站统一沿用首页设计风格。

**Architecture:** 先在认证链路中增加一个站内过渡页，解决“浏览器已经登录但服务端还没稳定认出用户”的时间差问题，再把 `/workspace` 入口从直接抛错改成分流兜底。随后逐步替换后台和额度页中的静态假数据，统一改为读取 Supabase 真实数据，并在视觉上对齐首页的卡片、按钮、导航和错误状态。

**Tech Stack:** Next.js App Router, React, Supabase Auth, Supabase Postgres, Vercel, Vitest, Testing Library, TypeScript

---

### Task 1: 补一条“账号状态检查”真接口

**Files:**
- Create: `app/api/auth/session-ready/route.ts`
- Test: `tests/unit/auth-session-ready-route.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/auth/current-user", () => ({
  getCurrentSessionUser: vi.fn()
}));

describe("GET /api/auth/session-ready", () => {
  it("returns ready true when current session user exists", async () => {
    const { getCurrentSessionUser } = await import("../../src/lib/auth/current-user");
    vi.mocked(getCurrentSessionUser).mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      role: "user"
    });

    const { GET } = await import("../../app/api/auth/session-ready/route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ready: true });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/unit/auth-session-ready-route.test.ts`
Expected: FAIL because `app/api/auth/session-ready/route.ts` does not exist.

**Step 3: Write minimal implementation**

实现一个只做一件事的接口：

- 调用 `getCurrentSessionUser()`
- 如果取到用户，返回 `{ ready: true }`
- 如果没取到，返回 `{ ready: false }`
- 不抛 `500`

**Step 4: Run test to verify it passes**

Run: `pnpm vitest tests/unit/auth-session-ready-route.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/api/auth/session-ready/route.ts tests/unit/auth-session-ready-route.test.ts
git commit -m "feat: add auth session readiness route"
```

---

### Task 2: 新增登录完成过渡页

**Files:**
- Create: `app/auth/complete/page.tsx`
- Create: `src/components/auth/auth-complete-page-client.tsx`
- Test: `tests/unit/auth-complete-page.test.tsx`

**Step 1: Write the failing test**

```tsx
import { renderToString } from "react-dom/server";
import { expect, it } from "vitest";
import AuthCompletePage from "../../app/auth/complete/page";

it("renders the branded auth complete page", async () => {
  const html = renderToString(await AuthCompletePage());
  expect(html).toContain("登录成功，正在进入工作台");
  expect(html).toContain("客服支持团队");
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/unit/auth-complete-page.test.tsx`
Expected: FAIL because the page does not exist.

**Step 3: Write minimal implementation**

页面必须：

- 使用当前首页一致的导航和卡片语言
- 显示“登录成功，正在进入工作台”
- 用客户端组件去请求 `/api/auth/session-ready`
- 成功后跳转 `/workspace`
- 失败时显示：
  - 重新进入工作台
  - 返回登录页
  - 联系客服支持团队

**Step 4: Run test to verify it passes**

Run: `pnpm vitest tests/unit/auth-complete-page.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add app/auth/complete/page.tsx src/components/auth/auth-complete-page-client.tsx tests/unit/auth-complete-page.test.tsx
git commit -m "feat: add branded auth completion page"
```

---

### Task 3: 登录和注册改成先跳过渡页

**Files:**
- Modify: `src/components/auth/login-form.tsx`
- Modify: `src/components/auth/register-form.tsx`
- Test: `tests/unit/login-form.test.tsx`
- Test: `tests/unit/register-flow.test.tsx`

**Step 1: Write the failing test**

```tsx
it("redirects login success to auth complete instead of workspace", async () => {
  // mock signInWithPassword success
  // render component
  // submit form
  // expect window.location.assign to be called with "/auth/complete?next=%2Fworkspace"
});
```

```tsx
it("redirects register success to auth complete instead of workspace", async () => {
  // mock register success + login success
  // expect window.location.assign to be called with "/auth/complete?next=%2Fworkspace"
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/unit/login-form.test.tsx tests/unit/register-flow.test.tsx`
Expected: FAIL because current code still jumps straight to `/workspace`.

**Step 3: Write minimal implementation**

- 登录成功后跳转：
  - `/auth/complete?next=%2Fworkspace`
- 注册成功后也跳转到同一路径
- 状态文案保持首页同风格

**Step 4: Run test to verify it passes**

Run: `pnpm vitest tests/unit/login-form.test.tsx tests/unit/register-flow.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/auth/login-form.tsx src/components/auth/register-form.tsx tests/unit/login-form.test.tsx tests/unit/register-flow.test.tsx
git commit -m "feat: route auth success through completion screen"
```

---

### Task 4: 工作台入口从直接抛错改成分流兜底

**Files:**
- Modify: `app/(app)/workspace/page.tsx`
- Modify: `src/lib/auth/current-user.ts`
- Test: `tests/unit/workspace-entry.test.tsx`
- Test: `tests/unit/current-user.test.ts`

**Step 1: Write the failing test**

```tsx
it("redirects to /auth/complete when session is not fully ready", async () => {
  // mock getCurrentSessionWallet to throw AUTH_REQUIRED
  // expect workspace page to redirect to /auth/complete?next=%2Fworkspace
});
```

```ts
it("exposes a non-throwing readiness check for partially ready sessions", async () => {
  // add helper that returns null/partial state instead of throwing
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/unit/workspace-entry.test.tsx tests/unit/current-user.test.ts`
Expected: FAIL because current workspace page throws and becomes 500.

**Step 3: Write minimal implementation**

- `current-user.ts` 增加一个“温和检查”方法
- `/workspace` 使用这个温和检查
- 分情况：
  - 未登录：跳 `/login`
  - 刚登录未稳定：跳 `/auth/complete?next=%2Fworkspace`
  - 已登录：正常渲染工作台

**Step 4: Run test to verify it passes**

Run: `pnpm vitest tests/unit/workspace-entry.test.tsx tests/unit/current-user.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/'(app)'/workspace/page.tsx src/lib/auth/current-user.ts tests/unit/workspace-entry.test.tsx tests/unit/current-user.test.ts
git commit -m "fix: guard workspace entry with auth completion redirect"
```

---

### Task 5: 做一张首页风格的站内错误页

**Files:**
- Create: `app/(app)/workspace/error.tsx`
- Create: `src/components/app/branded-error-state.tsx`
- Test: `tests/unit/workspace-error-page.test.tsx`

**Step 1: Write the failing test**

```tsx
it("renders a branded workspace error state", async () => {
  const html = renderToString(<WorkspaceError error={new Error("boom")} reset={() => {}} />);
  expect(html).toContain("暂时还没能进入工作台");
  expect(html).toContain("联系客服支持团队");
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/unit/workspace-error-page.test.tsx`
Expected: FAIL because the branded error page does not exist.

**Step 3: Write minimal implementation**

- 不再暴露默认白屏错误
- 提供：
  - 重新进入工作台
  - 返回首页
  - 联系客服支持团队
- 视觉必须沿用首页样式

**Step 4: Run test to verify it passes**

Run: `pnpm vitest tests/unit/workspace-error-page.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add app/'(app)'/workspace/error.tsx src/components/app/branded-error-state.tsx tests/unit/workspace-error-page.test.tsx
git commit -m "feat: add branded workspace error state"
```

---

### Task 6: 把额度页“最近记录”从假数据换成真流水

**Files:**
- Modify: `src/components/pages/billing-page-client.tsx`
- Create: `src/lib/payments/ledger.ts`
- Create: `app/api/quota/ledger/route.ts`
- Test: `tests/unit/quota-ledger-route.test.ts`
- Test: `tests/unit/billing-page.test.tsx`

**Step 1: Write the failing test**

```ts
it("returns the current user's real quota ledger items", async () => {
  // mock current session user and quota ledger repository
  // expect array items instead of hardcoded demo rows
});
```

```tsx
it("does not render hardcoded 2023 demo history rows", async () => {
  // render billing page with fetched ledger data
  // assert 2023 demo text is absent
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/unit/quota-ledger-route.test.ts tests/unit/billing-page.test.tsx`
Expected: FAIL because page still renders hardcoded history.

**Step 3: Write minimal implementation**

- 新建真实流水读取层
- 用户端只显示自己的记录
- 没有记录时显示首页风格空状态，不显示假样例

**Step 4: Run test to verify it passes**

Run: `pnpm vitest tests/unit/quota-ledger-route.test.ts tests/unit/billing-page.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/pages/billing-page-client.tsx src/lib/payments/ledger.ts app/api/quota/ledger/route.ts tests/unit/quota-ledger-route.test.ts tests/unit/billing-page.test.tsx
git commit -m "feat: show real quota ledger on billing page"
```

---

### Task 7: 中控台用户管理接入真数据

**Files:**
- Create: `src/lib/admin/repository.ts`
- Modify: `src/components/admin/user-table.tsx`
- Create: `app/api/admin/users/[userId]/freeze/route.ts`
- Create: `app/api/admin/users/[userId]/adjust-quota/route.ts`
- Test: `tests/unit/admin-repository.test.ts`
- Test: `tests/unit/admin-user-actions.test.ts`

**Step 1: Write the failing test**

```ts
it("loads real users from profiles and quota_wallets", async () => {
  // expect repository to map real rows
});
```

```ts
it("freezes a user and records an audit entry", async () => {
  // expect freeze route to update profile and insert audit log
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/unit/admin-repository.test.ts tests/unit/admin-user-actions.test.ts`
Expected: FAIL because admin UI still uses `mock-data`.

**Step 3: Write minimal implementation**

- 后台用户表改为读真实数据库
- 冻结/解冻接真接口
- 手动加积分/扣积分接真接口
- 写审计日志

**Step 4: Run test to verify it passes**

Run: `pnpm vitest tests/unit/admin-repository.test.ts tests/unit/admin-user-actions.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/admin/repository.ts src/components/admin/user-table.tsx app/api/admin/users/[userId]/freeze/route.ts app/api/admin/users/[userId]/adjust-quota/route.ts tests/unit/admin-repository.test.ts tests/unit/admin-user-actions.test.ts
git commit -m "feat: wire admin user management to live data"
```

---

### Task 8: 中控台任务、文件、财务摘要接入真数据

**Files:**
- Modify: `src/components/admin/task-table.tsx`
- Modify: `src/components/admin/file-table.tsx`
- Modify: `src/components/admin/finance-summary.tsx`
- Modify: `src/components/admin/order-table.tsx`
- Modify: `src/components/admin/pricing-editor.tsx`
- Modify: `src/lib/admin/repository.ts`
- Test: `tests/unit/admin-dashboard.test.tsx`

**Step 1: Write the failing test**

```tsx
it("renders real admin dashboard sections without mock-data rows", async () => {
  // mock repository data and assert real values appear
  // assert demo emails like client-a@example.com are absent
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/unit/admin-dashboard.test.tsx`
Expected: FAIL because components still import `mock-data`.

**Step 3: Write minimal implementation**

- 后台任务表、文件表、财务摘要、订单表、价格编辑全部改为读真实仓库层
- 移除对 `mock-data.ts` 的直接依赖
- 后台页面风格继续贴齐首页卡片风格

**Step 4: Run test to verify it passes**

Run: `pnpm vitest tests/unit/admin-dashboard.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/admin/task-table.tsx src/components/admin/file-table.tsx src/components/admin/finance-summary.tsx src/components/admin/order-table.tsx src/components/admin/pricing-editor.tsx src/lib/admin/repository.ts tests/unit/admin-dashboard.test.tsx
git commit -m "feat: replace admin mock panels with live data"
```

---

### Task 9: 清理 demo 页面和占位组件

**Files:**
- Delete or isolate: `app/(app)/workspace/demo/page.tsx`
- Modify or delete: `src/components/workspace/outline-review-panel.tsx`
- Modify or delete: `src/components/workspace/deliverables-panel.tsx`
- Test: `tests/unit/no-demo-placeholders.test.ts`

**Step 1: Write the failing test**

```ts
import { expect, it } from "vitest";
import { readFileSync } from "node:fs";

it("does not keep user-facing placeholder copy in production workspace components", () => {
  const outlinePanel = readFileSync("src/components/workspace/outline-review-panel.tsx", "utf8");
  const deliverablesPanel = readFileSync("src/components/workspace/deliverables-panel.tsx", "utf8");
  expect(outlinePanel).not.toContain("占位");
  expect(deliverablesPanel).not.toContain("占位");
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/unit/no-demo-placeholders.test.ts`
Expected: FAIL because placeholder copy still exists.

**Step 3: Write minimal implementation**

- 删除或隔离 demo 页面
- 把工作台旧占位组件删掉或替换成真组件
- 确保主流程目录里不再出现“占位”“模拟完成”等面向用户的文案

**Step 4: Run test to verify it passes**

Run: `pnpm vitest tests/unit/no-demo-placeholders.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/'(app)'/workspace/demo/page.tsx src/components/workspace/outline-review-panel.tsx src/components/workspace/deliverables-panel.tsx tests/unit/no-demo-placeholders.test.ts
git commit -m "chore: remove demo placeholders from workspace"
```

---

### Task 10: 把关键内页统一到首页风格

**Files:**
- Modify: `app/login/page.tsx`
- Modify: `app/register/page.tsx`
- Modify: `app/forgot-password/page.tsx`
- Modify: `app/reset-password/page.tsx`
- Modify: `app/auth/complete/page.tsx`
- Modify: `app/(app)/billing/page.tsx`
- Modify: `app/(app)/admin/layout.tsx`
- Test: `tests/unit/brand-consistency.test.tsx`

**Step 1: Write the failing test**

```tsx
it("keeps key pages on the same brand system as the homepage", async () => {
  // render key pages and assert navbar / support CTA / shared brand copy exists
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/unit/brand-consistency.test.tsx`
Expected: FAIL until all key pages share the same branded wrapper and support CTA.

**Step 3: Write minimal implementation**

- 把关键页面都收拢到统一的页面骨架
- 保持首页的导航、卡片、按钮、客服支持团队入口、留白、配色
- 不引入第二套后台视觉风格

**Step 4: Run test to verify it passes**

Run: `pnpm vitest tests/unit/brand-consistency.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add app/login/page.tsx app/register/page.tsx app/forgot-password/page.tsx app/reset-password/page.tsx app/auth/complete/page.tsx app/'(app)'/billing/page.tsx app/'(app)'/admin/layout.tsx tests/unit/brand-consistency.test.tsx
git commit -m "style: align auth app and admin surfaces with homepage brand"
```

---

### Task 11: 全量验证

**Files:**
- Modify as needed: `README.md`
- Verify: `tests/unit/*`
- Verify: `tests/e2e/*`

**Step 1: Run targeted test suites**

Run:

```bash
pnpm vitest tests/unit/auth-session-ready-route.test.ts tests/unit/auth-complete-page.test.tsx tests/unit/login-form.test.tsx tests/unit/register-flow.test.tsx tests/unit/workspace-entry.test.tsx tests/unit/current-user.test.ts tests/unit/workspace-error-page.test.tsx tests/unit/quota-ledger-route.test.ts tests/unit/admin-repository.test.ts tests/unit/admin-user-actions.test.ts tests/unit/admin-dashboard.test.tsx tests/unit/no-demo-placeholders.test.ts tests/unit/brand-consistency.test.tsx
```

Expected: PASS

**Step 2: Run broader regression suite**

Run:

```bash
pnpm test
```

Expected: PASS

**Step 3: Run lint**

Run:

```bash
pnpm lint
```

Expected: PASS

**Step 4: Manual production verification**

检查线上关键路径：

1. 注册成功后进入过渡页，再进入工作台
2. 登录成功后进入过渡页，再进入工作台
3. 过渡页失败时显示站内错误卡片，不是白页
4. 额度页显示真实流水或空状态
5. 中控台显示真实数据，不再出现 `client-a@example.com` 之类假样例

**Step 5: Commit**

```bash
git add README.md
git commit -m "docs: update stability and admin completion notes"
```

---

Plan complete and saved to `docs/plans/2026-03-03-pdd-workspace-stability-and-admin-completion-implementation.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**

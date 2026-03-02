# 拼代代PDD 前端完整迁移 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不改变后端能力的前提下，把 Vite 版视觉完整迁移到 Next 主站核心页面。

**Architecture:** 继续以 Next.js 作为唯一运行入口，统一公共样式层，逐页替换 UI，业务逻辑保持原路由和原接口。

**Tech Stack:** Next.js 16, React, TypeScript, Vitest

---

### Task 1: 统一全局视觉样式层

**Files:**
- Modify: `app/globals.css`

**Steps:**
1. 建立拼代代主题色、排版、按钮、卡片、网格、表单、响应式样式。
2. 保留现有基础 reset，不引入破坏性全局规则。
3. 提供公共页面与后台页面的共用类名。

### Task 2: 迁移公共页面（首页/登录/注册）

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/login/page.tsx`
- Modify: `app/register/page.tsx`

**Steps:**
1. 参考 Vite 页面结构迁移模块顺序与视觉层次。
2. 保留首页信任建立模块与销售转化模块。
3. 保留登录/注册的品牌露出和客服入口。

### Task 3: 迁移应用壳层与业务页面（工作台/任务/额度）

**Files:**
- Modify: `app/(app)/layout.tsx`
- Modify: `app/(app)/workspace/page.tsx`
- Modify: `app/(app)/tasks/page.tsx`
- Modify: `app/(app)/billing/page.tsx`
- Modify: `app/(app)/account/page.tsx`

**Steps:**
1. 重做 app 壳层导航、侧栏、顶部额度信息展示。
2. 工作台用新视觉承载现有流程组件。
3. 任务页改为可读性更强的列表卡片式展示。
4. 额度中心改为更接近 Vite 版的双栏布局。

### Task 4: 统一业务组件视觉（不改业务行为）

**Files:**
- Modify: `src/components/workspace/upload-dropzone.tsx`
- Modify: `src/components/workspace/special-requirements-field.tsx`
- Modify: `src/components/workspace/task-progress-panel.tsx`
- Modify: `src/components/workspace/outline-review-panel.tsx`
- Modify: `src/components/workspace/deliverables-panel.tsx`
- Modify: `src/components/workspace/manual-humanize-card.tsx`
- Modify: `src/components/billing/recharge-card.tsx`

**Steps:**
1. 统一卡片视觉、层级、按钮、文字密度。
2. 保留关键文案：激活码、500积分、自动降AI、人工联系客服。
3. 保持二维码使用 `/qrcode.jpg`。

### Task 5: 回归验证与发布

**Files:**
- Modify (if needed): `tests/unit/*.test.tsx`

**Steps:**
1. 运行 `pnpm lint`
2. 运行 `pnpm test`
3. 修复因 UI 文案变化导致的断言不一致
4. 提交并推送 `main`，触发 Vercel 自动部署

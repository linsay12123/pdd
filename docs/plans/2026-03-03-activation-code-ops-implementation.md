# 拼代代PDD Activation Code Ops Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the activation-code-first product flow end-to-end: strong admin code operations first, then user redemption UX with explicit failure reasons and live quota updates.

**Architecture:** Keep the existing Next.js app as the only runtime. Extend current activation code domain APIs (create/list/redeem) with stronger validation, filtering, and export. Then wire real API calls into admin and recharge pages so the UI is no longer static placeholders.

**Tech Stack:** Next.js 16 App Router, TypeScript, in-repo service modules, Vitest, Next API routes, existing Supabase auth/session helpers.

---

### Task 1: Harden Activation Code Domain Contracts

**Files:**
- Modify: `src/types/activation-codes.ts`
- Modify: `src/lib/activation-codes/repository.ts`
- Test: `tests/unit/activation-codes.test.ts`

**Step 1: Write the failing tests**

Extend `tests/unit/activation-codes.test.ts` to assert:
- list query can filter by `used` / `unused`
- batch create rejects `count > 50`
- invalid tier is rejected

**Step 2: Run test to verify it fails**

Run: `corepack pnpm exec vitest run tests/unit/activation-codes.test.ts`  
Expected: FAIL because repository does not yet enforce full query + max-count contract.

**Step 3: Implement minimal contract updates**

Update `src/types/activation-codes.ts`:
- add `ActivationCodeStatus = "unused" | "used"`
- add `ActivationCodeListQuery` shape

Update `src/lib/activation-codes/repository.ts`:
- enforce `count <= 50`
- enforce tier in `1000|5000|10000|20000`
- add list query support (`status`, `keyword`)

**Step 4: Re-run tests**

Run: `corepack pnpm exec vitest run tests/unit/activation-codes.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/types/activation-codes.ts src/lib/activation-codes/repository.ts tests/unit/activation-codes.test.ts
git commit -m "feat: harden activation code domain contract"
```

### Task 2: Complete Admin Activation Code APIs (Create/List)

**Files:**
- Modify: `app/api/admin/activation-codes/create/route.ts`
- Modify: `app/api/admin/activation-codes/list/route.ts`
- Modify: `src/lib/auth/admin-guard.ts`
- Test: `tests/unit/activation-code-admin-routes.test.ts`

**Step 1: Write failing tests**

Extend `tests/unit/activation-code-admin-routes.test.ts` to assert:
- list route supports `status` and `keyword` query
- create route rejects `count > 50` with clear reason
- non-admin request always returns 403

**Step 2: Run test to verify it fails**

Run: `corepack pnpm exec vitest run tests/unit/activation-code-admin-routes.test.ts`  
Expected: FAIL for missing query/filter behavior.

**Step 3: Implement minimal API updates**

In `create` route:
- parse and validate `tier`, `count`
- return clear validation errors

In `list` route:
- parse `status`, `keyword`
- call repository list query
- return stable array payload shape

In `admin-guard`:
- keep cookie-based admin check for now
- normalize cookie parse to avoid false positives

**Step 4: Re-run tests**

Run: `corepack pnpm exec vitest run tests/unit/activation-code-admin-routes.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add app/api/admin/activation-codes/create/route.ts app/api/admin/activation-codes/list/route.ts src/lib/auth/admin-guard.ts tests/unit/activation-code-admin-routes.test.ts
git commit -m "feat: complete admin activation code create and list routes"
```

### Task 3: Add Admin CSV Export API

**Files:**
- Create: `app/api/admin/activation-codes/export/route.ts`
- Modify: `src/lib/activation-codes/repository.ts`
- Test: `tests/unit/activation-code-export-route.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/activation-code-export-route.test.ts` to assert:
- non-admin gets 403
- admin gets `text/csv`
- export respects `status` and `keyword` filters

**Step 2: Run test to verify it fails**

Run: `corepack pnpm exec vitest run tests/unit/activation-code-export-route.test.ts`  
Expected: FAIL because route does not exist.

**Step 3: Implement minimal export route**

Create route:
- read admin auth guard
- fetch filtered rows from repository
- map to CSV header:
  `code,tier,status,used_by_user_id,created_at,used_at`
- return `NextResponse` with CSV content and download filename

**Step 4: Re-run test**

Run: `corepack pnpm exec vitest run tests/unit/activation-code-export-route.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add app/api/admin/activation-codes/export/route.ts src/lib/activation-codes/repository.ts tests/unit/activation-code-export-route.test.ts
git commit -m "feat: add admin activation code csv export route"
```

### Task 4: Build Admin Activation Code Panel UI (Real API, Not Static)

**Files:**
- Create: `src/components/admin/activation-code-panel.tsx`
- Modify: `app/(app)/admin/page.tsx`
- Modify: `src/components/admin/order-table.tsx` (or replace usage entirely)
- Test: `tests/unit/admin-shell.test.tsx`

**Step 1: Write failing UI assertions**

Update `tests/unit/admin-shell.test.tsx` to assert page contains:
- generate form (`tier`, `count`, submit button)
- filter controls (`全部/未使用/已使用`, keyword input)
- export button text

**Step 2: Run test to verify it fails**

Run: `corepack pnpm exec vitest run tests/unit/admin-shell.test.tsx`  
Expected: FAIL with missing UI strings.

**Step 3: Implement panel**

Create client component with:
- create form (tier select + count input)
- list table (full code visible)
- filter controls
- “复制全部” and “导出CSV” actions
- loading + error states

Wire into `app/(app)/admin/page.tsx` replacing the static order block.

**Step 4: Re-run test**

Run: `corepack pnpm exec vitest run tests/unit/admin-shell.test.tsx`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/admin/activation-code-panel.tsx app/(app)/admin/page.tsx src/components/admin/order-table.tsx tests/unit/admin-shell.test.tsx
git commit -m "feat: wire admin activation code panel to real APIs"
```

### Task 5: Add Quota Wallet Read API For Logged-In User

**Files:**
- Create: `app/api/quota/wallet/route.ts`
- Modify: `src/lib/payments/repository.ts`
- Test: `tests/unit/quota-wallet-route.test.ts`

**Step 1: Write failing route tests**

Create `tests/unit/quota-wallet-route.test.ts` asserting:
- missing user context returns 401
- valid user context returns current quota snapshot

**Step 2: Run test to verify it fails**

Run: `corepack pnpm exec vitest run tests/unit/quota-wallet-route.test.ts`  
Expected: FAIL because route does not exist.

**Step 3: Implement route**

Create route:
- resolve current user identity (existing session helper or interim user context helper)
- load wallet snapshot from repository
- return `{ rechargeQuota, frozenQuota }` payload

**Step 4: Re-run test**

Run: `corepack pnpm exec vitest run tests/unit/quota-wallet-route.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add app/api/quota/wallet/route.ts src/lib/payments/repository.ts tests/unit/quota-wallet-route.test.ts
git commit -m "feat: add quota wallet read api"
```

### Task 6: Wire Recharge Page To Real Redeem Flow

**Files:**
- Create: `src/components/billing/redeem-code-form.tsx`
- Modify: `src/components/billing/recharge-card.tsx`
- Modify: `app/(app)/billing/page.tsx`
- Test: `tests/unit/billing-page.test.tsx`

**Step 1: Write failing tests**

Extend `tests/unit/billing-page.test.tsx` to assert:
- redeem form section exists
- explicit error area exists
- success confirmation text exists

**Step 2: Run test to verify it fails**

Run: `corepack pnpm exec vitest run tests/unit/billing-page.test.tsx`  
Expected: FAIL because static placeholder has no real redeem form state.

**Step 3: Implement minimal client flow**

Build `redeem-code-form.tsx`:
- input code
- submit to `/api/quota/redeem-code`
- show explicit failure reasons from API
- on success refresh wallet via `/api/quota/wallet`

Wire component into `recharge-card.tsx`.

**Step 4: Re-run tests**

Run: `corepack pnpm exec vitest run tests/unit/billing-page.test.tsx`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/billing/redeem-code-form.tsx src/components/billing/recharge-card.tsx app/(app)/billing/page.tsx tests/unit/billing-page.test.tsx
git commit -m "feat: connect recharge page to redeem api"
```

### Task 7: Enforce Atomic Single-Use Redemption Behavior

**Files:**
- Modify: `src/lib/activation-codes/redeem-activation-code.ts`
- Modify: `src/lib/activation-codes/repository.ts`
- Test: `tests/unit/activation-codes.test.ts`
- Test: `tests/unit/activation-code-concurrency.test.ts`

**Step 1: Write failing concurrency test**

Create `tests/unit/activation-code-concurrency.test.ts`:
- generate one code
- attempt two near-simultaneous redeem calls
- assert exactly one succeeds

**Step 2: Run tests to verify failure**

Run: `corepack pnpm exec vitest run tests/unit/activation-codes.test.ts tests/unit/activation-code-concurrency.test.ts`  
Expected: FAIL if both calls can succeed in race conditions.

**Step 3: Implement atomic guard**

In repository redeem path:
- lock/update by `unused` status in one step
- return explicit “已被使用” when second call fails

**Step 4: Re-run tests**

Run: `corepack pnpm exec vitest run tests/unit/activation-codes.test.ts tests/unit/activation-code-concurrency.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/activation-codes/redeem-activation-code.ts src/lib/activation-codes/repository.ts tests/unit/activation-codes.test.ts tests/unit/activation-code-concurrency.test.ts
git commit -m "fix: enforce single-use atomic redemption"
```

### Task 8: Update Admin + User Copy And Remove Payment Terminology Drift

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/(app)/layout.tsx`
- Modify: `app/(app)/billing/page.tsx`
- Modify: `tests/smoke/homepage.test.ts`

**Step 1: Write/adjust failing copy checks**

Ensure tests assert:
- no online payment CTA in user paths
- activation-code wording is consistent

**Step 2: Run test to verify failure (if drift exists)**

Run: `corepack pnpm exec vitest run tests/smoke/homepage.test.ts tests/unit/billing-page.test.tsx`  
Expected: FAIL if stale copy remains.

**Step 3: Update copy only**

Normalize wording:
- “额度激活码”
- “生成文章固定扣 500 积分”
- “自动降AI固定扣 500 积分”

**Step 4: Re-run tests**

Run: `corepack pnpm exec vitest run tests/smoke/homepage.test.ts tests/unit/billing-page.test.tsx`  
Expected: PASS

**Step 5: Commit**

```bash
git add app/page.tsx app/(app)/layout.tsx app/(app)/billing/page.tsx tests/smoke/homepage.test.ts
git commit -m "chore: normalize activation-code copy across user pages"
```

### Task 9: Final Verification + Docs Update

**Files:**
- Modify: `README.md`
- Modify: `docs/runbooks/launch-checklist.md`
- Modify: `docs/runbooks/payment-recovery.md`

**Step 1: Run full verification**

Run:
- `corepack pnpm lint`
- `corepack pnpm test`
- `corepack pnpm exec next build --webpack`

Expected: all PASS

**Step 2: Update docs**

Document:
- activation code create/list/export workflow
- user redeem workflow
- known failure reasons and support script

**Step 3: Commit**

```bash
git add README.md docs/runbooks/launch-checklist.md docs/runbooks/payment-recovery.md
git commit -m "docs: finalize activation-code operations runbook"
```

### Task 10: Prepare Merge-Ready Summary

**Files:**
- Create: `docs/plans/2026-03-03-activation-code-ops-delivery-summary.md`

**Step 1: Summarize delivered scope**

Include:
- completed tasks
- API list
- UI changes
- test/build evidence

**Step 2: Commit**

```bash
git add docs/plans/2026-03-03-activation-code-ops-delivery-summary.md
git commit -m "docs: add activation-code ops delivery summary"
```


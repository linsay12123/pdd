# 拼代代PDD 前端合并与激活码模式替换 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Merge the new 拼代代PDD branded frontend experience into the main Next.js product, then replace user-facing payment semantics with activation-code-based quota rules.

**Architecture:** Keep the Next.js app in `bootstrap-shell` as the only production application. Use the Vite project in `拼代代-pdd` purely as a visual and copy source, migrating its branded UI into reusable Next.js components and existing protected routes. Replace user-facing payment UI first, then swap backend quota and billing behavior to activation-code redemption in later tasks.

**Tech Stack:** Next.js 16, React, TypeScript, Tailwind-like utility styling via inline CSS and reusable React components, Vitest, Playwright, existing in-memory repositories pending later persistence wiring.

---

### Task 1: Import Brand Assets Into The Main App

**Files:**
- Copy from: `/Users/jeffo/Desktop/自动写作/logo.jpg`
- Copy from: `/Users/jeffo/Desktop/自动写作/qrcode.jpg`
- Create: `public/logo.jpg`
- Create: `public/qrcode.jpg`
- Test: `tests/unit/brand-assets.test.ts`

**Step 1: Write the failing test**

Create a test that checks the two asset files exist under the main app `public` directory.

**Step 2: Run test to verify it fails**

Run: `corepack pnpm test -- tests/unit/brand-assets.test.ts`
Expected: FAIL because the files are missing in the main app.

**Step 3: Copy the assets into the main app**

Copy:
- `/Users/jeffo/Desktop/自动写作/logo.jpg` -> `public/logo.jpg`
- `/Users/jeffo/Desktop/自动写作/qrcode.jpg` -> `public/qrcode.jpg`

**Step 4: Run test to verify it passes**

Run: `corepack pnpm test -- tests/unit/brand-assets.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add public/logo.jpg public/qrcode.jpg tests/unit/brand-assets.test.ts
git commit -m "feat: add pindaidai brand assets"
```

### Task 2: Add Shared Brand Components For The Main App

**Files:**
- Create: `src/components/brand/brand-logo.tsx`
- Create: `src/components/brand/contact-sales-card.tsx`
- Modify: `app/layout.tsx`
- Test: `tests/unit/brand-components.test.tsx`

**Step 1: Write the failing test**

Add a component test that renders `BrandLogo` and `ContactSalesCard` and checks:
- the text `拼代代PDD`
- the logo image path `/logo.jpg`
- the QR image path `/qrcode.jpg`

**Step 2: Run test to verify it fails**

Run: `corepack pnpm test -- tests/unit/brand-components.test.tsx`
Expected: FAIL because the components do not exist.

**Step 3: Implement the shared components**

`brand-logo.tsx` should:
- render `/logo.jpg`
- render `拼代代PDD`
- support compact and large variants

`contact-sales-card.tsx` should:
- render a sales title
- render `/qrcode.jpg`
- explain that users should contact sales to buy activation codes

**Step 4: Run test to verify it passes**

Run: `corepack pnpm test -- tests/unit/brand-components.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/brand app/layout.tsx tests/unit/brand-components.test.tsx
git commit -m "feat: add shared pindaidai brand components"
```

### Task 3: Replace The Landing Page With The Branded Sales Homepage

**Files:**
- Modify: `app/page.tsx`
- Create: `src/components/marketing/hero-section.tsx`
- Create: `src/components/marketing/trust-bar.tsx`
- Create: `src/components/marketing/use-cases.tsx`
- Create: `src/components/marketing/process-section.tsx`
- Create: `src/components/marketing/features-grid.tsx`
- Create: `src/components/marketing/case-studies.tsx`
- Create: `src/components/marketing/testimonials.tsx`
- Create: `src/components/marketing/service-standards.tsx`
- Create: `src/components/marketing/faq-section.tsx`
- Test: `tests/unit/homepage-brand.test.tsx`

**Step 1: Write the failing test**

Add a page test for `/` markup that checks:
- `拼代代PDD`
- `购买额度请联系销售团队`
- `生成完整文章（含大纲与核验报告）`
- the contact QR image path

**Step 2: Run test to verify it fails**

Run: `corepack pnpm test -- tests/unit/homepage-brand.test.tsx`
Expected: FAIL because the homepage is still the old simple link.

**Step 3: Build the new homepage**

Migrate the visual structure from `拼代代-pdd/src/pages/Home.tsx`, but convert it into reusable Next.js components.

Keep these sections:
- Hero
- trust strip
- target audience
- process
- features
- case studies
- testimonials
- service standards
- activation-code rules
- sales contact block
- FAQ

**Step 4: Run test to verify it passes**

Run: `corepack pnpm test -- tests/unit/homepage-brand.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add app/page.tsx src/components/marketing tests/unit/homepage-brand.test.tsx
git commit -m "feat: replace landing page with branded sales homepage"
```

### Task 4: Upgrade Login And Add Register

**Files:**
- Modify: `app/login/page.tsx`
- Create: `app/register/page.tsx`
- Test: `tests/e2e/auth-brand.spec.ts`

**Step 1: Write the failing test**

Create an end-to-end test that checks:
- `/login` shows `拼代代PDD`
- `/register` loads successfully
- both pages contain a sales help link

**Step 2: Run test to verify it fails**

Run: `corepack pnpm test:e2e tests/e2e/auth-brand.spec.ts`
Expected: FAIL because `/register` does not exist and the login page is still basic.

**Step 3: Implement the branded auth pages**

Migrate the visual structure from:
- `拼代代-pdd/src/pages/Login.tsx`
- `拼代代-pdd/src/pages/Register.tsx`

Adapt for Next.js app routes.

**Step 4: Run test to verify it passes**

Run: `corepack pnpm test:e2e tests/e2e/auth-brand.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/login/page.tsx app/register/page.tsx tests/e2e/auth-brand.spec.ts
git commit -m "feat: upgrade auth pages to branded flow"
```

### Task 5: Convert Billing Into The Activation Center

**Files:**
- Modify: `app/(app)/billing/page.tsx`
- Modify: `src/components/billing/recharge-card.tsx`
- Create: `app/recharge/page.tsx`
- Test: `tests/unit/activation-center.test.tsx`

**Step 1: Write the failing test**

Add a page test that checks the billing page contains:
- `激活码兑换`
- `当前可用积分`
- `1000`
- `5000`
- `10000`
- `20000`
- and does not contain `Stripe`, `支付宝`, `微信支付`, `USDC`

**Step 2: Run test to verify it fails**

Run: `corepack pnpm test -- tests/unit/activation-center.test.tsx`
Expected: FAIL because the page still reflects the old payment-oriented structure.

**Step 3: Implement the activation center**

Replace the billing UI with:
- current points summary
- activation code input
- rule explanation
- four fixed point tiers
- consumption rule reminders
- recent history
- branded sales QR block

Add `/recharge` as a user-friendly alias that renders or redirects to the same experience.

**Step 4: Run test to verify it passes**

Run: `corepack pnpm test -- tests/unit/activation-center.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add app/(app)/billing/page.tsx app/recharge/page.tsx src/components/billing/recharge-card.tsx tests/unit/activation-center.test.tsx
git commit -m "feat: convert billing into activation center"
```

### Task 6: Restyle Workspace And Tasks Using The New Frontend As Template

**Files:**
- Modify: `app/(app)/workspace/page.tsx`
- Modify: `src/components/workspace/upload-dropzone.tsx`
- Modify: `src/components/workspace/special-requirements-field.tsx`
- Modify: `src/components/workspace/task-progress-panel.tsx`
- Modify: `src/components/workspace/outline-review-panel.tsx`
- Modify: `src/components/workspace/deliverables-panel.tsx`
- Modify: `src/components/workspace/manual-humanize-card.tsx`
- Modify: `app/(app)/tasks/page.tsx`
- Test: `tests/unit/workspace-brand.test.tsx`
- Test: `tests/unit/tasks-brand.test.tsx`

**Step 1: Write the failing tests**

Add tests that check:
- workspace shows `500 积分`
- workspace shows branded header copy
- tasks page shows branded header copy and points consumption labels

**Step 2: Run tests to verify they fail**

Run: `corepack pnpm test -- tests/unit/workspace-brand.test.tsx tests/unit/tasks-brand.test.tsx`
Expected: FAIL because the current pages are still the old shell.

**Step 3: Apply the new visual shell**

Use the Vite pages as design references:
- `拼代代-pdd/src/pages/Workspace.tsx`
- `拼代代-pdd/src/pages/Tasks.tsx`

Preserve the existing functional section order of the Next.js app.

**Step 4: Run tests to verify they pass**

Run: `corepack pnpm test -- tests/unit/workspace-brand.test.tsx tests/unit/tasks-brand.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add app/(app)/workspace/page.tsx app/(app)/tasks/page.tsx src/components/workspace tests/unit/workspace-brand.test.tsx tests/unit/tasks-brand.test.tsx
git commit -m "feat: restyle workspace and tasks for pindaidai"
```

### Task 7: Replace User-Facing Payment Language Everywhere

**Files:**
- Modify: `app/(app)/layout.tsx`
- Modify: `app/(app)/account/page.tsx`
- Modify: `src/lib/admin/mock-data.ts`
- Modify: `README.md`
- Test: `tests/unit/no-payment-copy.test.ts`

**Step 1: Write the failing test**

Add a text-scan test across user-facing page components that fails if it finds:
- `Stripe`
- `支付购买`
- `月订阅`
- `USDC（Solana / Ethereum / TRON）`

Allow these strings only in frozen backend-only files or historical docs, not in user-facing app pages.

**Step 2: Run test to verify it fails**

Run: `corepack pnpm test -- tests/unit/no-payment-copy.test.ts`
Expected: FAIL if old payment copy still exists.

**Step 3: Replace copy**

Update all user-facing app text to use:
- `激活码兑换`
- `积分`
- `联系销售团队`
- `额度激活`

**Step 4: Run test to verify it passes**

Run: `corepack pnpm test -- tests/unit/no-payment-copy.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/(app)/layout.tsx app/(app)/account/page.tsx src/lib/admin/mock-data.ts README.md tests/unit/no-payment-copy.test.ts
git commit -m "refactor: replace payment copy with activation code language"
```

### Task 8: Add Activation Code Domain Types And In-Memory Store

**Files:**
- Modify: `src/types/billing.ts`
- Create: `src/types/activation-codes.ts`
- Create: `src/lib/activation-codes/repository.ts`
- Test: `tests/unit/activation-codes.test.ts`

**Step 1: Write the failing test**

Add unit tests covering:
- generating a random activation code
- assigning one of the four allowed tiers
- marking a code as used
- preventing reuse

**Step 2: Run test to verify it fails**

Run: `corepack pnpm test -- tests/unit/activation-codes.test.ts`
Expected: FAIL because the activation code repository does not exist.

**Step 3: Implement minimal activation code storage**

Create an in-memory repository with:
- code
- tier value
- status (`unused` or `used`)
- createdAt
- redeemedAt
- redeemedByUserId

Allowed values:
- `1000`
- `5000`
- `10000`
- `20000`

**Step 4: Run test to verify it passes**

Run: `corepack pnpm test -- tests/unit/activation-codes.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types/activation-codes.ts src/lib/activation-codes/repository.ts src/types/billing.ts tests/unit/activation-codes.test.ts
git commit -m "feat: add activation code domain model"
```

### Task 9: Replace Variable Pricing With Fixed 500-Point Rules

**Files:**
- Modify: `src/lib/billing/quote-task-cost.ts`
- Modify: `tests/unit/billing-rules.test.ts`
- Create: `tests/unit/fixed-pricing.test.ts`

**Step 1: Write the failing test**

Add tests that require:
- any article generation quote returns `500`
- any humanize quote returns `500`

**Step 2: Run test to verify it fails**

Run: `corepack pnpm test -- tests/unit/fixed-pricing.test.ts`
Expected: FAIL because current logic still uses word-count tiers.

**Step 3: Implement the minimal fixed-pricing change**

Replace the variable-tier pricing with:
- generation = `500`
- humanize = `500`

Keep the API shape the same so calling code does not break.

**Step 4: Run test to verify it passes**

Run: `corepack pnpm test -- tests/unit/fixed-pricing.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/billing/quote-task-cost.ts tests/unit/billing-rules.test.ts tests/unit/fixed-pricing.test.ts
git commit -m "feat: switch to fixed 500-point pricing"
```

### Task 10: Add Activation Code Redemption Instead Of Payment Recharge

**Files:**
- Create: `app/api/activation-codes/redeem/route.ts`
- Modify: `src/lib/payments/repository.ts`
- Modify: `app/api/tasks/create/route.ts`
- Modify: `app/api/tasks/[taskId]/humanize/route.ts`
- Test: `tests/unit/redeem-activation-code.test.ts`

**Step 1: Write the failing test**

Add tests that cover:
- redeeming an unused activation code increases user points
- redeeming a used code throws an error
- task creation still checks the user balance against the new fixed point rules

**Step 2: Run test to verify it fails**

Run: `corepack pnpm test -- tests/unit/redeem-activation-code.test.ts`
Expected: FAIL because there is no activation-code redemption route or integration.

**Step 3: Implement minimal redemption flow**

Add:
- an API route to redeem a code
- a repository function to credit points on successful redemption
- task charge checks that use the updated fixed cost

Do not yet delete old payment storage; just stop using it for new user-facing recharge.

**Step 4: Run test to verify it passes**

Run: `corepack pnpm test -- tests/unit/redeem-activation-code.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/api/activation-codes/redeem/route.ts src/lib/payments/repository.ts app/api/tasks/create/route.ts app/api/tasks/[taskId]/humanize/route.ts tests/unit/redeem-activation-code.test.ts
git commit -m "feat: add activation code redemption flow"
```

### Task 11: Add Admin Tools To Generate And Review Activation Codes

**Files:**
- Create: `app/(app)/admin/codes/page.tsx`
- Create: `src/components/admin/activation-code-table.tsx`
- Modify: `app/(app)/admin/layout.tsx`
- Modify: `src/lib/admin/mock-data.ts`
- Test: `tests/unit/admin-activation-codes.test.tsx`

**Step 1: Write the failing test**

Add a component/page test that checks:
- admin navigation includes an activation code management entry
- the admin codes page lists generated codes and used/unused status

**Step 2: Run test to verify it fails**

Run: `corepack pnpm test -- tests/unit/admin-activation-codes.test.tsx`
Expected: FAIL because the admin code page does not exist.

**Step 3: Implement admin activation code management shell**

The page should support a UI shell for:
- generating codes
- listing code tiers
- showing used/unused state
- showing who redeemed the code

Use mock or in-memory data first.

**Step 4: Run test to verify it passes**

Run: `corepack pnpm test -- tests/unit/admin-activation-codes.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add app/(app)/admin/codes/page.tsx app/(app)/admin/layout.tsx src/components/admin/activation-code-table.tsx src/lib/admin/mock-data.ts tests/unit/admin-activation-codes.test.tsx
git commit -m "feat: add admin activation code management"
```

### Task 12: Run Full Validation And Freeze Legacy Payment UI

**Files:**
- Modify: `docs/runbooks/launch-checklist.md`
- Modify: `docs/runbooks/payment-recovery.md`
- Modify: `docs/runbooks/payment-account-onboarding.md`
- Modify: `README.md`

**Step 1: Run the full local validation suite**

Run:
- `corepack pnpm lint`
- `corepack pnpm test`
- `corepack pnpm build`
- `corepack pnpm test:e2e`

Expected:
- all checks pass
- user-facing payment copy is gone
- branded routes render correctly

**Step 2: Update runbooks**

Replace remaining user-facing payment assumptions with:
- activation-code purchase via sales
- QR-based sales contact
- admin code generation workflow

**Step 3: Verify the final route set**

Confirm these routes work:
- `/`
- `/login`
- `/register`
- `/billing`
- `/recharge`
- `/workspace`
- `/tasks`

**Step 4: Commit**

```bash
git add docs/runbooks README.md
git commit -m "docs: finalize activation code operating model"
```
